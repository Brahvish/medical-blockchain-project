// scripts/seedRecords.ts
import { network } from "hardhat";

// Use the Hardhat v3 style
const { ethers } = await network.connect();

// ⛔ CHANGE THIS IF YOU REDEPLOY THE CONTRACT
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

async function main() {
  console.log("🔗 Seeding MedicalRecords at:", CONTRACT_ADDRESS);

  const medicalRecords = await ethers.getContractAt(
    "MedicalRecords",
    CONTRACT_ADDRESS
  );

  const [deployer, patient, doctor] = await ethers.getSigners();

  console.log("👤 Deployer:", deployer.address);
  console.log("🧍 Patient :", patient.address);
  console.log("🩺 Doctor  :", doctor.address);
  console.log("--------------------------------------------------");

  // --- Ensure patient exists ---
  const patientData = await medicalRecords.patients(patient.address);
  if (!patientData.exists) {
    console.log("📝 Patient not found. Registering patient Alice...");
    const tx = await medicalRecords
      .connect(patient)
      .registerPatient("Alice", "Female", 25);
    await tx.wait();
    console.log("✅ Patient registered.");
  } else {
    console.log("ℹ️ Patient already registered.");
  }

  // --- Ensure doctor exists ---
  const doctorData = await medicalRecords.doctors(doctor.address);
  if (!doctorData.exists) {
    console.log("📝 Doctor not found. Registering Dr. Rahul (Cardiology)...");
    const tx = await medicalRecords
      .connect(doctor)
      .registerDoctor("Dr. Rahul", "Cardiology");
    await tx.wait();
    console.log("✅ Doctor registered.");
  } else {
    console.log("ℹ️ Doctor already registered.");
  }

  // --- Sample CIDs to insert (fake medical records) ---
  const sampleCIDs = [
    "CID-LabReport-001",
    "CID-LabReport-002",
    "CID-XRayChest-2025-01",
    "CID-MRI-Brain-2025-02",
    "CID-ECG-Checkup-2025-03",
    "CID-BloodTest-FullPanel-2025-04",
    "CID-Ultrasound-Abdomen-2025-05",
    "CID-CovidTest-2025-06",
    "CID-DentalScan-2025-07",
    "CID-DischargeSummary-2025-08"
  ];

  console.log("\n📦 Seeding batch medical records...\n");

  for (const cid of sampleCIDs) {
    console.log(`📤 Uploading CID: ${cid}`);
    const tx = await medicalRecords
      .connect(doctor)
      .uploadRecord(
        patient.address,
        cid,
        `${cid}.pdf`,
        "Seeded medical record",
        "dummy-key"
      );

    await tx.wait();
    console.log("   ✔️ Stored on-chain");
  }

  // --- Show final count for confirmation ---
  const records = await medicalRecords
    .connect(patient)
    .getRecords(patient.address);

  console.log("\n📚 Seeding complete.");
  console.log(`✅ Total records for patient now: ${records.length}`);
}

main().catch((error) => {
  console.error("❌ Error in seed script:", error);
  process.exitCode = 1;
});
