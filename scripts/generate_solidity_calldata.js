const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

/**
 * This script takes the raw proof.json and publicSignals.json
 * and converts them into the exact Solidity calldata format required
 * to call verifyProof(a, b, c, input) on the Verifier.sol smart contract.
 */
async function run() {
    if (process.argv.length < 4) {
        console.log("Usage: node generate_solidity_calldata.js <publicSignals.json> <proof.json>");
        process.exit(1);
    }
    
    const publicSignalsPath = process.argv[2];
    const proofPath = process.argv[3];
    
    const publicSignals = JSON.parse(fs.readFileSync(publicSignalsPath));
    const proof = JSON.parse(fs.readFileSync(proofPath));
    
    const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    
    console.log("\n=======================================================");
    console.log("🔥 SOLIDITY SMART CONTRACT CALLDATA 🔥");
    console.log("Copy and paste this EXACT string into Remix IDE's verifyProof function:");
    console.log("=======================================================\n");
    console.log(calldata);
    console.log("\n=======================================================\n");
}

run();
