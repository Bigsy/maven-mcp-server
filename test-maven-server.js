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

// Run the tests
testMavenAPI().catch(console.error);