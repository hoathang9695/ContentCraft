
#!/usr/bin/env node

import { execSync } from 'child_process';

async function runSimulateComplain() {
  console.log('🚀 Starting Complain Simulation Script...');
  
  try {
    console.log('📝 Running simulate-complain-kafka.ts...');
    
    // Execute the simulation script
    const output = execSync('npx tsx simulate-complain-kafka.ts', {
      encoding: 'utf8',
      stdio: 'inherit'
    });
    
    console.log('✅ Complain simulation completed successfully!');
    
  } catch (error) {
    console.error('❌ Error running complain simulation:', error);
    process.exit(1);
  }
}

// Run the script
runSimulateComplain();
