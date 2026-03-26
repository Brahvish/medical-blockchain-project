// scripts/interactMedicalRecords.ts
import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // ⛔ CHANGE THIS IF YOU REDEPLOY THE CONTRACT

  console.log("🔗 Connecting to MedicalRecords at:", CONTRACT_ADDRESS);

  const medicalRecords = await ethers.getContractAt(
    "MedicalRecords",
    CONTRACT_ADDRESS
  );

  const [deployer, patient, doctor] = await ethers.getSigners();

  console.log("👤 Deployer:", deployer.address);
  console.log("🧍 Patient :", patient.address);
  console.log("🩺 Doctor  :", doctor.address);
  console.log("--------------------------------------------------");

  // Register patient
  const patientData = await medicalRecords.patients(patient.address);

  if (!patientData.exists) {
    console.log("📝 Registering patient...");
    await (
      await medicalRecords
        .connect(patient)
        .registerPatient("Alice", "Female", 25)
    ).wait();
  }

  // Register doctor
  const doctorData = await medicalRecords.doctors(doctor.address);

  if (!doctorData.exists) {
    console.log("📝 Registering doctor...");
    await (
      await medicalRecords
        .connect(doctor)
        .registerDoctor("Dr. Rahul", "Cardiology")
    ).wait();
  }

  // Upload record
  console.log("📤 Uploading record...");
  await (
    await medicalRecords
      .connect(doctor)
      .uploadRecord(patient.address, "QmTestCID123")
  ).wait();

  // Fetch records
  const records = await medicalRecords
    .connect(patient)
    .getRecords(patient.address);

  console.log("📚 Records:", records);

  console.log("✅ Interaction success.");
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exitCode = 1;
});
