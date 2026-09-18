pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

/*
 * Compliance ZK Circuit
 * Proves knowledge of (wallet_hash, risk_tier, timestamp, secret_salt)
 * such that their Poseidon hash equals the public commitment.
 * Also generates a public nullifier from the secret_salt to prevent double-spending proofs.
 */
template ComplianceProof() {
    // Private Inputs
    signal input wallet_hash;
    signal input risk_tier;
    signal input timestamp;
    signal input secret_salt;
    
    // Public Outputs
    signal output commitment;
    signal output nullifier;

    // Hash the 4 inputs into a commitment using Poseidon
    component poseidonCommitment = Poseidon(4);
    poseidonCommitment.inputs[0] <== wallet_hash;
    poseidonCommitment.inputs[1] <== risk_tier;
    poseidonCommitment.inputs[2] <== timestamp;
    poseidonCommitment.inputs[3] <== secret_salt;
    
    commitment <== poseidonCommitment.out;

    // Hash the secret_salt with 0 to create a nullifier
    component poseidonNullifier = Poseidon(2);
    poseidonNullifier.inputs[0] <== secret_salt;
    poseidonNullifier.inputs[1] <== 0;
    
    nullifier <== poseidonNullifier.out;
}

// Main component: export the commitment and nullifier as public outputs
component main = ComplianceProof();
