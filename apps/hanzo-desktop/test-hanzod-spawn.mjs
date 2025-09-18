#!/usr/bin/env node

import fetch from 'node-fetch';

console.log('Testing hanzod spawn via Tauri command...');

// The app is running with Remote UI on port 9090
// We need to trigger the hanzod_spawn command

async function testHanzodSpawn() {
  try {
    // First check if hanzod is already running
    console.log('Checking if hanzod is already running on port 3690...');
    try {
      const healthCheck = await fetch('http://localhost:3690/health', { 
        method: 'GET',
        timeout: 2000 
      });
      if (healthCheck.ok) {
        console.log('✅ hanzod is already running!');
        const health = await healthCheck.text();
        console.log('Health response:', health);
        return;
      }
    } catch (e) {
      console.log('hanzod not running yet, will attempt to spawn...');
    }

    // Simulate clicking the Get Started button by calling the Tauri command
    console.log('Attempting to spawn hanzod via Tauri command...');
    
    // Note: We can't directly call Tauri commands from outside the app context
    // Instead, let's monitor if hanzod starts after user interaction
    
    console.log('\n📝 Manual Test Instructions:');
    console.log('1. Open the Hanzo AI desktop app window');
    console.log('2. Check the "I agree to the Terms and Conditions" checkbox');
    console.log('3. Click the "Get Started" button');
    console.log('4. Wait for hanzod to spawn...\n');
    
    // Poll for hanzod to start
    console.log('Polling for hanzod to start on port 3690...');
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds
    
    const pollInterval = setInterval(async () => {
      attempts++;
      process.stdout.write(`Attempt ${attempts}/${maxAttempts}... `);
      
      try {
        const response = await fetch('http://localhost:3690/health', { 
          method: 'GET',
          timeout: 1000 
        });
        
        if (response.ok) {
          clearInterval(pollInterval);
          console.log('\n✅ SUCCESS! hanzod is running on port 3690!');
          const health = await response.text();
          console.log('Health response:', health);
          
          // Test the actual hanzod API
          console.log('\nTesting hanzod API...');
          const modelsResponse = await fetch('http://localhost:3690/api/tags');
          if (modelsResponse.ok) {
            const models = await modelsResponse.json();
            console.log('Available models:', JSON.stringify(models, null, 2));
          }
          
          process.exit(0);
        }
      } catch (e) {
        process.stdout.write('not running yet\n');
      }
      
      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        console.log('\n❌ FAILED: hanzod did not start within 60 seconds');
        process.exit(1);
      }
    }, 1000);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testHanzodSpawn();