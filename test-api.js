// test-api.js - Simple script to test API endpoints
import dotenv from 'dotenv';

dotenv.config();

// Get the API base URL - use local Vercel dev server or deployed URL
// For deployed: https://your-project.vercel.app/api
// For local: http://localhost:3000/api (run: vercel dev)
const API_BASE = process.env.API_BASE_URL || process.argv[2] || 'http://localhost:3000/api';

console.log('🧪 Testing Zefrix API Endpoints...\n');
console.log(`API Base URL: ${API_BASE}\n`);

async function testEndpoint(name, endpoint, method = 'GET', body = null) {
  try {
    console.log(`Testing: ${name}`);
    console.log(`  URL: ${API_BASE}/${endpoint}`);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_BASE}/${endpoint}`, options);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`  ✅ Success (${response.status})`);
      console.log(`  Response:`, JSON.stringify(data, null, 2));
      console.log('');
      return { success: true, data };
    } else {
      console.log(`  ❌ Failed (${response.status})`);
      console.log(`  Error:`, data);
      console.log('');
      return { success: false, error: data };
    }
  } catch (error) {
    console.log(`  ❌ Error:`, error.message);
    console.log('');
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('='.repeat(50));
  console.log('TEST 1: List All Classes');
  console.log('='.repeat(50));
  await testEndpoint('List All Classes', 'list-classes');
  
  console.log('='.repeat(50));
  console.log('TEST 2: Pending Classes');
  console.log('='.repeat(50));
  await testEndpoint('Pending Classes', 'pending-classes');
  
  console.log('='.repeat(50));
  console.log('TEST 3: Admin Stats');
  console.log('='.repeat(50));
  await testEndpoint('Admin Stats', 'admin-stats');
  
  console.log('='.repeat(50));
  console.log('✅ All tests completed!');
  console.log('='.repeat(50));
}

runTests().catch(console.error);

