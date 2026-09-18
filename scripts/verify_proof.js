const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

async function run() {
    const vKeyPath = path.join(__dirname, "../circuits/vkey.json");
    
    // Check if arguments are provided
    if (process.argv.length < 4) {
        console.log("Usage: node verify_proof.js <publicSignals.json> <proof.json>");
        process.exit(1);
    }
    
    const publicSignalsPath = process.argv[2];
    const proofPath = process.argv[3];
    
    const vKey = JSON.parse(fs.readFileSync(vKeyPath));
    const publicSignals = JSON.parse(fs.readFileSync(publicSignalsPath));
    const proof = JSON.parse(fs.readFileSync(proofPath));
    
    const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    
    if (res === true) {
        console.log("Verification OK");
    } else {
        console.log("Invalid proof");
    }
}

run();
