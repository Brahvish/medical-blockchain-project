import { network } from "hardhat";

const { ethers, networkName } = await network.connect();

async function main() {
  console.log(`Deploying MedicalRecords to ${networkName}...`);

  const medicalRecords = await ethers.deployContract("MedicalRecords");

  console.log("Waiting for the deployment tx to confirm...");
  await medicalRecords.waitForDeployment();

  const address = await medicalRecords.getAddress();
  console.log("✅ MedicalRecords deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
