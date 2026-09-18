const snarkjs = require("snarkjs");
const path = require("path");

async function generateProof() {
    let inputData = "";
    process.stdin.setEncoding('utf8');

    for await (const chunk of process.stdin) {
        inputData += chunk;
    }

    try {
        const witness = JSON.parse(inputData);
        
        const wasmPath = path.join(__dirname, "../circuits/compliance_js/compliance.wasm");
        const zkeyPath = path.join(__dirname, "../circuits/compliance.zkey");

        const { proof, publicSignals } = await snarkjs.groth16.fullProve(witness, wasmPath, zkeyPath);

        console.log(JSON.stringify({ proof, publicSignals }));
        process.exit(0);
    } catch (error) {
        console.error(JSON.stringify({ error: error.message }));
        process.exit(1);
    }
}

generateProof();
