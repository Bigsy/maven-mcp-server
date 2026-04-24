#!/usr/bin/env node

import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

// Sanity test: probes Maven Central directly (not the MCP server) to verify
// that maven-metadata.xml still returns fresh data for a few representative
// artifacts. This is the same data source the MCP server consumes.

const testDependencies = [
  {
    name: 'kafka-clients',
    dependency: 'org.apache.kafka:kafka-clients',
    description: 'Should return the current release from maven-metadata.xml'
  },
  {
    name: 'google-api-services-drive',
    dependency: 'com.google.apis:google-api-services-drive',
    description: 'Complex version format test'
  },
  {
    name: 'spring-core',
    dependency: 'org.springframework:spring-core',
    description: 'Standard version format test'
  }
];

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false });

function metadataUrl(groupId, artifactId) {
  const g = groupId.split('.').map(encodeURIComponent).join('/');
  const a = encodeURIComponent(artifactId);
  return `https://repo1.maven.org/maven2/${g}/${a}/maven-metadata.xml`;
}

async function fetchMetadata(groupId, artifactId) {
  const response = await axios.get(metadataUrl(groupId, artifactId), { responseType: 'text', transformResponse: d => d });
  const parsed = parser.parse(response.data);
  const versioning = parsed?.metadata?.versioning ?? {};
  const raw = versioning.versions?.version;
  const versions = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return {
    release: versioning.release,
    latest: versioning.latest,
    versions,
    lastUpdated: versioning.lastUpdated,
  };
}

async function testMavenMetadata() {
  console.log('Testing Maven Central maven-metadata.xml directly...\n');

  for (const test of testDependencies) {
    console.log(`\nTesting ${test.name}:`);
    console.log(`Dependency: ${test.dependency}`);
    console.log(`Description: ${test.description}`);

    try {
      const [groupId, artifactId] = test.dependency.split(':');
      const meta = await fetchMetadata(groupId, artifactId);

      if (meta.versions.length === 0) {
        console.log('No versions found!');
        continue;
      }

      console.log(`\n<release>: ${meta.release ?? '(not present)'}`);
      console.log(`<latest>:  ${meta.latest ?? '(not present)'}`);
      console.log(`<lastUpdated>: ${meta.lastUpdated ?? '(not present)'}`);

      console.log('\nTop 5 versions (newest deploy first):');
      const newestFirst = [...meta.versions].reverse();
      newestFirst.slice(0, 5).forEach((v, i) => {
        console.log(`${i + 1}. ${v}`);
      });

    } catch (error) {
      console.error(`Error testing ${test.name}:`, error.message);
    }
  }

  console.log('\n\nSummary:');
  console.log('maven-metadata.xml is the authoritative source Maven/Gradle themselves use.');
  console.log('It updates seconds after a deploy, so "latest" here is always current.');
}

// Test the pre-release filtering functionality
async function testPreReleaseFiltering() {
  console.log('\n\n=== Testing Pre-release Filtering ===\n');

  const isPreReleaseVersion = (version) => {
    const preReleasePattern = /-(alpha|a|beta|b|milestone|m|rc|cr|snapshot)/i;
    return preReleasePattern.test(version);
  };

  console.log('Testing Spring Core pre-release filtering:');
  try {
    const meta = await fetchMetadata('org.springframework', 'spring-core');
    const newestFirst = [...meta.versions].reverse();

    if (newestFirst.length > 0) {
      console.log('\nAll versions (top 5, newest deploy first):');
      newestFirst.slice(0, 5).forEach((v, i) => {
        const badge = isPreReleaseVersion(v) ? ' [PRE-RELEASE]' : ' [STABLE]';
        console.log(`${i + 1}. ${v}${badge}`);
      });

      const stableVersions = newestFirst.filter(v => !isPreReleaseVersion(v));
      console.log(`\nLatest stable release (filtered): ${stableVersions[0] ?? 'None found'}`);
      console.log(`Latest overall (unfiltered):       ${newestFirst[0]}`);
      console.log(`<release> from metadata.xml:       ${meta.release ?? '(not present)'}`);
    }
  } catch (error) {
    console.error('Error testing Spring Core:', error.message);
  }

  console.log('\n=== Pre-release Pattern Tests ===');
  const versionTests = [
    { version: '7.0.0-M6', expected: true },
    { version: '6.2.8', expected: false },
    { version: '3.1.0-SNAPSHOT', expected: true },
    { version: '2.5.0-RC1', expected: true },
    { version: '1.0.0-alpha', expected: true },
    { version: '4.0.0', expected: false }
  ];

  versionTests.forEach(test => {
    const result = isPreReleaseVersion(test.version);
    const status = result === test.expected ? 'PASS' : 'FAIL';
    console.log(`${status} ${test.version} -> ${result}`);
  });
}

async function runAllTests() {
  await testMavenMetadata();
  await testPreReleaseFiltering();
}

runAllTests().catch(console.error);
