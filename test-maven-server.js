#!/usr/bin/env node

import axios from 'axios';

// Test configuration
const testDependencies = [
  {
    name: 'kafka-clients',
    dependency: 'org.apache.kafka:kafka-clients',
    description: 'Should return the most recently updated version'
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

async function testMavenAPI() {
  console.log('Testing Maven Central API directly...\n');
  
  for (const test of testDependencies) {
    console.log(`\nTesting ${test.name}:`);
    console.log(`Dependency: ${test.dependency}`);
    console.log(`Description: ${test.description}`);
    
    try {
      // Parse dependency
      const [groupId, artifactId] = test.dependency.split(':');
      
      // Test getting the most recently updated version
      const response = await axios.get('https://search.maven.org/solrsearch/select', {
        params: {
          q: `g:"${groupId}" AND a:"${artifactId}"`,
          core: 'gav',
          rows: 5,
          wt: 'json',
          sort: 'timestamp desc'
        }
      });
      
      if (response.data.response.docs.length > 0) {
        const mostRecent = response.data.response.docs[0];
        console.log(`\nMost recently updated version: ${mostRecent.v}`);
        console.log(`Last updated: ${new Date(mostRecent.timestamp).toISOString()}`);
        
        console.log('\nTop 5 versions by last updated date:');
        response.data.response.docs.forEach((doc, index) => {
          console.log(`${index + 1}. ${doc.v} - ${new Date(doc.timestamp).toISOString().split('T')[0]}`);
        });
      } else {
        console.log('No versions found!');
      }
      
    } catch (error) {
      console.error(`Error testing ${test.name}:`, error.message);
    }
  }
  
  console.log('\n\nSummary:');
  console.log('The server now returns the most recently updated version, not necessarily the highest semantic version.');
  console.log('Users who need specific versions can use list_maven_versions to see all versions sorted by update date.');
}

// Test the pre-release filtering functionality
async function testPreReleaseFiltering() {
  console.log('\n\n=== Testing Pre-release Filtering ===\n');

  // Function to test if version is pre-release (same as in server)
  const isPreReleaseVersion = (version) => {
    const preReleasePattern = /-(alpha|a|beta|b|milestone|m|rc|cr|snapshot)/i;
    return preReleasePattern.test(version);
  };

  // Test with Spring Core (has M6 milestone versions)
  console.log('Testing Spring Core pre-release filtering:');
  try {
    const response = await axios.get('https://search.maven.org/solrsearch/select', {
      params: {
        q: 'g:"org.springframework" AND a:"spring-core"',
        core: 'gav',
        rows: 10,
        wt: 'json',
        sort: 'timestamp desc',
      }
    });

    if (response.data.response.docs.length > 0) {
      console.log('\nAll versions (top 5):');
      response.data.response.docs.slice(0, 5).forEach((doc, i) => {
        const badge = isPreReleaseVersion(doc.v) ? ' [PRE-RELEASE]' : ' [STABLE]';
        console.log(`${i + 1}. ${doc.v} (${new Date(doc.timestamp).toISOString().split('T')[0]})${badge}`);
      });

      // Filter stable versions
      const stableVersions = response.data.response.docs.filter(doc => !isPreReleaseVersion(doc.v));
      console.log(`\n✅ Latest stable release (filtered): ${stableVersions[0]?.v || 'None found'}`);
      console.log(`⚠️  Latest overall (unfiltered): ${response.data.response.docs[0].v}`);
    }
  } catch (error) {
    console.error('Error testing Spring Core:', error.message);
  }

  // Test regex pattern
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
    const status = result === test.expected ? '✅' : '❌';
    console.log(`${status} ${test.version} -> ${result}`);
  });
}

// Run both test suites
async function runAllTests() {
  await testMavenAPI();
  await testPreReleaseFiltering();
}

runAllTests().catch(console.error);