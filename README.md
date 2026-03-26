# 🩺 Blockchain-Based Medical Records System

## 📌 Project Title
Enhancing Privacy and Security in Healthcare through Blockchain-Enabled Data Sharing

---

## 🚀 Overview

This project is a decentralized application (DApp) designed to securely store and share medical records using blockchain and IPFS.

It eliminates centralized control and ensures:
- Data integrity
- Privacy
- Secure sharing between doctors and patients

---

## 🏗️ Tech Stack

### Blockchain
- Solidity (Smart Contract)
- Hardhat (Local Ethereum Network)

### Frontend
- React + Vite + TypeScript
- Tailwind CSS

### Web3
- Ethers.js (v6)
- MetaMask

### Storage
- IPFS (via Pinata)

### Encryption
- AES Encryption (crypto-js)

---

## 🔐 Security Design

### File Security
- Medical files are encrypted using AES before uploading to IPFS

### Key Handling
- AES key is encoded and stored on-chain
- Currently implemented as a simplified model for demonstration

### Note:
This can be upgraded using MetaMask encryption (`eth_decrypt`) for production-level security

---

## ⚙️ Features

### 👤 User Roles
- Patient
- Doctor
- Same wallet can act as both

---

### 📤 Upload Medical Record
1. Doctor selects file
2. File is encrypted using AES
3. Encrypted file uploaded to IPFS
4. CID stored on blockchain along with metadata

---

### 📥 Fetch Records
- Retrieve records using patient address
- Data fetched from blockchain

---

### 🔓 View Record
1. Fetch encrypted file from IPFS
2. Decode AES key
3. Decrypt file
4. Reconstruct file (Uint8Array)
5. Display in browser

---

### 📜 Audit Logs
- Tracks uploads with doctor + patient + timestamp

---

## 📁 Project Structure
BLOCKCHAIN PROJECT/
│
├── medical_blockchain/ # Smart contracts + Hardhat
├── health-ledger-47-main/ # Frontend (React)

---

## ▶️ How to Run

### Backend

```bash
cd medical_blockchain
npx hardhat node
npx hardhat run scripts/deployMedicalRecords.ts --network localhost

Frontend

cd health-ledger-47-main/health-ledger-47-main
npm install
npm run dev

⚠️ Limitations
AES key protection is simplified (base64 encoding)
No strict role-based access control in smart contract
No key recovery mechanism

🚀 Future Improvements
MetaMask-based encryption (eth_decrypt)
Role-based access control
Improved UI/UX
Download feature
Event-driven audit logs

🎯 Conclusion

This system demonstrates how blockchain and decentralized storage can be combined to create a secure and privacy-preserving medical record system.