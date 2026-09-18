#!/bin/bash
set -e

echo "1. Compiling circuit..."
$HOME/.cargo/bin/circom compliance.circom --r1cs --wasm --sym

echo "2. Generating Powers of Tau ceremony file locally..."
if [ ! -f powersOfTau28_hez_final_12.ptau ]; then
    npx snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
    npx snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v -e="random text"
    npx snarkjs powersoftau prepare phase2 pot12_0001.ptau powersOfTau28_hez_final_12.ptau -v
fi

echo "3. Generating Phase 2 trusted setup (zkey)..."
# In a real production environment, you would use a secure source of randomness.
npx snarkjs groth16 setup compliance.r1cs powersOfTau28_hez_final_12.ptau compliance_0000.zkey

echo "4. Contributing to the Phase 2 ceremony..."
npx snarkjs zkey contribute compliance_0000.zkey compliance.zkey --name="LexIO 1st Contributor" -v -e="random text"

echo "5. Exporting Verification Key..."
npx snarkjs zkey export verificationkey compliance.zkey vkey.json

echo "Done! The proving key (compliance.zkey) and verification key (vkey.json) are ready."
