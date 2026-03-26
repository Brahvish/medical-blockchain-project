import { useEffect, useState } from "react";
import { ethers } from "ethers";
import axios from "axios";
import { CONTRACT_ADDRESS, MEDICAL_RECORDS_ABI } from "@/blockchainConfig";
import {
  GlassCard,
  InputField,
  ActionButton,
  StatusBadge,
  SectionHeader,
  RecordCard,
} from "@/components/medical";
import {
  Wallet,
  Copy,
  UserCircle,
  Stethoscope,
  FileText,
  Upload,
  Activity,
  Shield,
  Users,
} from "lucide-react";

import CryptoJS from "crypto-js";

declare global {
  interface Window {
    ethereum?: any;
  }
}

type UserRole = "NONE" | "PATIENT" | "DOCTOR" | "BOTH";

type RecordEntry = {
  cid: string;
  filename: string;
  description: string;
  encryptedKey: string;
  timestamp: bigint;
  uploadedBy: string;
};

const shortenAddress = (addr?: string | null) => {
  if (!addr) return "";
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

const uploadFileToIPFS = async (file: File): Promise<string> => {
  const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
  const formData = new FormData();
  formData.append("file", file);

  console.log("JWT:", import.meta.env.VITE_PINATA_JWT);

  const res = await axios.post(url, formData, {
    maxBodyLength: Infinity,
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_PINATA_JWT}`,
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data.IpfsHash;
};

const encryptFile = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();
  const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer as any);

  const aesKey = CryptoJS.lib.WordArray.random(32).toString();

  const encrypted = CryptoJS.AES.encrypt(wordArray, aesKey).toString();

  return {
    encryptedData: encrypted,
    aesKey: aesKey,
  };
};

const decryptFile = (encryptedData: string, aesKey: string) => {
  const bytes = CryptoJS.AES.decrypt(encryptedData, aesKey);

  return bytes;
};

const handleViewFile = async (cid: string, encryptedKey: string, filename: string) => {
  try {
    // 1. Fetch encrypted file from IPFS
    const res = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
    const encryptedData = await res.arrayBuffer();
    const encryptedText = new TextDecoder().decode(encryptedData);

    // 2. Decode AES key
    // TEMP FIX: directly extract AES key (since we encoded it simply)
    const decoded = atob(encryptedKey);
    const parts = decoded.split("::");

    if (!parts[0]) {
      throw new Error("Invalid encrypted key");
    }

    const aesKey = parts[0];

    // 3. Decrypt file
    const decryptedWordArray = decryptFile(encryptedText, aesKey);

    // convert WordArray → Uint8Array
    const words = decryptedWordArray.words;
    const sigBytes = decryptedWordArray.sigBytes;

    const byteArray = new Uint8Array(sigBytes);

    for (let i = 0; i < sigBytes; i++) {
      byteArray[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }

    let type = "application/octet-stream";

    // 🔥 detect from actual file bytes (correct way)
    if (byteArray[0] === 0xFF && byteArray[1] === 0xD8) {
      type = "image/jpeg";
    } else if (byteArray[0] === 0x89 && byteArray[1] === 0x50) {
      type = "image/png";
    } else if (
      byteArray[0] === 0x25 &&
      byteArray[1] === 0x50 &&
      byteArray[2] === 0x44 &&
      byteArray[3] === 0x46
    ) {
      type = "application/pdf";
    }

    const blob = new Blob([byteArray], { type });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <body style="margin:0">
            ${
              type.startsWith("image")
                ? `<img src="${url}" style="width:100%;height:auto;" />`
                : type === "application/pdf"
                ? `<iframe src="${url}" width="100%" height="100%"></iframe>`
                : `<p>File preview not supported. Downloading...</p>`
            }
          </body>
        </html>
      `);
    }

  } catch (err) {
    console.error("Error decrypting file:", err);
  }
};

const encryptAESKey = async (aesKey: string, patientAddress: string) => {
  if (!window.ethereum) throw new Error("MetaMask not found");

  const publicKey = await window.ethereum.request({
    method: "eth_getEncryptionPublicKey",
    params: [patientAddress],
  });

  // simple encoding (safe for browser)
  const encrypted = btoa(aesKey + "::" + publicKey);

  return encrypted;
};

const Index = () => {
  const [account, setAccount] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Not connected");
  const [patientAddress, setPatientAddress] = useState<string>("");
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [role, setRole] = useState<UserRole>("NONE");

  const [patientName, setPatientName] = useState<string>("");
  const [patientGender, setPatientGender] = useState<string>("");
  const [patientAge, setPatientAge] = useState<string>("");

  const [doctorName, setDoctorName] = useState<string>("");
  const [doctorSpec, setDoctorSpec] = useState<string>("");

  const [registeringPatient, setRegisteringPatient] = useState(false);
  const [registeringDoctor, setRegisteringDoctor] = useState(false);

  const getContract = async () => {
    if (!window.ethereum) throw new Error("No MetaMask");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new ethers.Contract(CONTRACT_ADDRESS, MEDICAL_RECORDS_ABI, signer);
  };

  const detectRole = async (addr?: string | null) => {
    try {
      const targetAddress = addr || account;
      if (!targetAddress) {
        setRole("NONE");
        return;
      }

      const contract = await getContract();
      const [patientInfo, doctorInfo] = await Promise.all([
        contract.patients(targetAddress),
        contract.doctors(targetAddress),
      ]);

      const isPatient =
        (patientInfo && patientInfo.exists === true) ||
        (Array.isArray(patientInfo) && patientInfo[4] === true);

      const isDoctor =
        (doctorInfo && doctorInfo.exists === true) ||
        (Array.isArray(doctorInfo) && doctorInfo[3] === true);

      if (isDoctor && isPatient) {
        setRole("BOTH");
      } else if (isDoctor) {
        setRole("DOCTOR");
      } else if (isPatient) {
        setRole("PATIENT");
      } else {
        setRole("NONE");
      }
    } catch (err) {
      console.error("Role detection failed:", err);
      setRole("NONE");
    }
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("MetaMask not detected. Please install MetaMask.");
        return;
      }

      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });

      const newAccounts: string[] = await window.ethereum.request({
        method: "eth_accounts",
      });

      if (!newAccounts || newAccounts.length === 0) {
        setStatus("No accounts found in MetaMask.");
        setAccount(null);
        setRole("NONE");
        setPatientAddress("");
        return;
      }

      const active = newAccounts[0];
      setAccount(active);
      setStatus("Connected");
      setPatientAddress(active);
      await detectRole(active);
    } catch (error) {
      console.error(error);
      setStatus("Failed to connect");
      setRole("NONE");
    }
  };

  const fetchRecords = async () => {
    try {
      if (!account) {
        alert("Connect your wallet first.");
        return;
      }

      if (role === "NONE") {
        const msg = "Please register as a patient or doctor to access medical records.";
        setStatus(msg);
        alert(msg);
        return;
      }

      if (!patientAddress) {
        alert("Enter a patient address first.");
        return;
      }

      if (role === "PATIENT" && patientAddress.toLowerCase() !== account.toLowerCase()) {
        const msg = "As a patient, you can only view your own records.";
        setStatus(msg);
        alert(msg);
        return;
      }

      setLoading(true);
      setStatus("Fetching records from blockchain...");

      const contract = await getContract();
      const rawRecords = await contract.getRecords(patientAddress);

      const parsed: RecordEntry[] = rawRecords.map((r: any) => ({
        cid: r[0],
        filename: r[1],
        description: r[2],
        encryptedKey: r[3], // 🔥 correct position
        timestamp: r[4],
        uploadedBy: r[5],
      }));

      console.log("PARSED RECORDS:", parsed);
      
      setRecords(parsed);
      getAuditLogs();
      setStatus(`Loaded ${parsed.length} record(s).`);
    } catch (error: any) {
      console.error("fetchRecords error:", error);
      const raw =
        error?.reason ||
        error?.shortMessage ||
        error?.data?.message ||
        error?.message ||
        "Unknown error fetching records";
      setStatus(raw);
      alert(raw);
    } finally {
      setLoading(false);
    }
  };

  const uploadRecord = async () => {
    try {
      if (!account) return alert("Connect wallet");
      if (role !== "DOCTOR" && role !== "BOTH") return alert("Only doctor can upload");
      if (!patientAddress) return alert("Enter patient address");
      if (!ethers.isAddress(patientAddress.trim())) {
        alert("Invalid patient address");
        return;
      }
      if (!selectedFile) return alert("Select a file");

      setUploading(true);
      setStatus("Uploading file to IPFS...");

      // 🔐 Encrypt file first
      const { encryptedData, aesKey } = await encryptFile(selectedFile);
      const encryptedKey = await encryptAESKey(aesKey, patientAddress);
      console.log("ENCRYPTED KEY:", encryptedKey);

      console.log("ENCRYPTED KEY:", encryptedKey);

      // convert encrypted string → file (for IPFS upload)
      const encryptedBlob = new Blob([encryptedData], { type: "text/plain" });
      const encryptedFile = new File([encryptedBlob], "encrypted.txt");

      // upload encrypted file
      const cid = await uploadFileToIPFS(encryptedFile);

      console.log("AES KEY (IMPORTANT):", aesKey);
      setStatus("Saving CID on blockchain...");

      const contract = await getContract();
      const tx = await contract.uploadRecord(
        patientAddress,
        cid,
        fileName,
        description,
        encryptedKey
      );
      await tx.wait();

      setStatus("Upload successful");
      setSelectedFile(null);
      setFileName("");
      setDescription("");
      fetchRecords();
    } catch (err) {
      console.error(err);
      setStatus("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const registerAsPatient = async () => {
    try {
      if (!account) {
        alert("Connect your wallet first.");
        return;
      }
      if (!patientName.trim() || !patientGender.trim() || !patientAge.trim()) {
        alert("Fill name, gender and age.");
        return;
      }

      const ageNum = Number(patientAge);
      if (Number.isNaN(ageNum) || ageNum <= 0) {
        alert("Enter a valid age.");
        return;
      }

      setRegisteringPatient(true);
      setStatus("Sending transaction to register as patient...");

      const contract = await getContract();
      const tx = await contract.registerPatient(patientName.trim(), patientGender.trim(), ageNum);
      await tx.wait();

      setStatus("Registered as patient successfully.");
      setPatientAddress(account);
      await detectRole(account);
    } catch (error: any) {
      console.error(error);
      setStatus(error?.reason || "Error registering as patient");
    } finally {
      setRegisteringPatient(false);
    }
  };

  const registerAsDoctor = async () => {
    try {
      if (!account) {
        alert("Connect your wallet first.");
        return;
      }
      if (!doctorName.trim() || !doctorSpec.trim()) {
        alert("Fill name and specialization.");
        return;
      }

      setRegisteringDoctor(true);
      const contract = await getContract();

      setStatus("Checking if already a doctor...");
      const existing = await contract.doctors(account);

      const already =
        (existing && existing.exists === true) ||
        (Array.isArray(existing) && existing[3] === true);

      if (already) {
        setStatus("You are already registered as a doctor.");
        await detectRole(account);
        return;
      }

      setStatus("Sending transaction to register as doctor...");
      const tx = await contract.registerDoctor(doctorName.trim(), doctorSpec.trim());
      await tx.wait();

      setStatus("Registered as doctor successfully.");
      await detectRole(account);
    } catch (error: any) {
      console.error(error);
      const rawMessage =
        error?.reason || error?.data?.message || error?.message || "Error registering as doctor";
      setStatus(rawMessage);
    } finally {
      setRegisteringDoctor(false);
    }
  };

  const formatTimestamp = (ts: bigint) => {
    const n = Number(ts);
    if (!n) return "-";
    return new Date(n * 1000).toLocaleString();
  };

  const handleCopyAddress = async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      setStatus("Copied address to clipboard");
    } catch {
      setStatus("Failed to copy address");
    }
  };

  const handleUseMyAddress = () => {
    if (!account) return;
    setPatientAddress(account);
    setStatus("Using your address as patient address");
  };

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        setAccount(null);
        setPatientAddress("");
        setRole("NONE");
        setStatus("Not connected");
        return;
      }

      const active = accounts[0];
      setAccount(active);
      setPatientAddress(active);
      setStatus("Connected");
      detectRole(active);
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);

    return () => {
      if (window.ethereum && window.ethereum.removeListener) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      }
    };
  }, []);

  const canShowPatientForm = role === "NONE" || role === "DOCTOR";
  const canShowDoctorForm = role === "NONE";

  const getRoleBadge = () => {
    if (!account) return null;
    switch (role) {
      case "NONE":
        return <StatusBadge variant="unregistered">Unregistered</StatusBadge>;
      case "PATIENT":
        return (
          <StatusBadge variant="patient" icon={<UserCircle className="w-3.5 h-3.5" />}>
            Patient
          </StatusBadge>
        );
      case "DOCTOR":
        return (
          <StatusBadge variant="doctor" icon={<Stethoscope className="w-3.5 h-3.5" />}>
            Doctor
          </StatusBadge>
        );
      case "BOTH":
        return (
          <StatusBadge variant="both" icon={<Users className="w-3.5 h-3.5" />}>
            Patient & Doctor
          </StatusBadge>
        );
    }
  };

 const getAuditLogs = async () => {
    try {
      const contract = await getContract();

      console.log("FRAGMENTS:", contract.interface.fragments);

      const logs = await contract.queryFilter("RecordUploaded");

      console.log("AUDIT LOGS:", logs);
      setAuditLogs(logs);

    } catch (err) {
      console.error("Error fetching logs:", err);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 glow-teal">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">MedChain</h1>
                <p className="text-xs text-muted-foreground">Decentralized Medical Records</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getRoleBadge()}
              <ActionButton
                variant={account ? "ghost" : "primary"}
                icon={<Wallet className="w-4 h-4" />}
                onClick={connectWallet}
              >
                {account ? shortenAddress(account) : "Connect Wallet"}
              </ActionButton>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Status Banner */}
        <GlassCard className="p-4" glow="teal">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium text-foreground">{status}</p>
            </div>
            {account && (
              <div className="flex gap-2">
                <ActionButton variant="ghost" icon={<Copy className="w-4 h-4" />} onClick={handleCopyAddress}>
                  Copy
                </ActionButton>
                <ActionButton variant="success" icon={<UserCircle className="w-4 h-4" />} onClick={handleUseMyAddress}>
                  Use My Address
                </ActionButton>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Role-based Dashboard Header */}
        {role === "NONE" && (
          <GlassCard highlight>
            <SectionHeader
              icon={<Shield className="w-5 h-5" />}
              title="Registration Required"
              description="Please register as a patient or doctor to access medical records."
            />
          </GlassCard>
        )}

        {role === "PATIENT" && (
          <GlassCard glow="emerald">
            <SectionHeader
              icon={<UserCircle className="w-5 h-5" />}
              title="Patient Dashboard"
              description="You can view your own medical records. Uploading is restricted to doctors."
            />
          </GlassCard>
        )}

        {(role === "DOCTOR" || role === "BOTH") && (
          <GlassCard glow="blue">
            <SectionHeader
              icon={<Stethoscope className="w-5 h-5" />}
              title="Doctor Dashboard"
              description="You can view and upload medical records for registered patients."
            />
          </GlassCard>
        )}

        {/* Registration Forms */}
        {(role === "NONE" || role === "PATIENT" || role === "DOCTOR") &&
          (canShowPatientForm || canShowDoctorForm) && (
            <section>
              <SectionHeader
                icon={<FileText className="w-5 h-5" />}
                title="Registration"
                description="Register the connected wallet as a patient or a doctor."
              />
              <div className="grid md:grid-cols-2 gap-6">
                {canShowPatientForm && (
                  <GlassCard glow="emerald">
                    <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
                      <UserCircle className="w-5 h-5 text-medical-emerald" />
                      Register as Patient
                    </h3>
                    <div className="space-y-4">
                      <InputField
                        label="Full Name"
                        placeholder="Enter your name"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                      />
                      <InputField
                        label="Gender"
                        placeholder="Enter your gender"
                        value={patientGender}
                        onChange={(e) => setPatientGender(e.target.value)}
                      />
                      <InputField
                        label="Age"
                        type="number"
                        placeholder="Enter your age"
                        value={patientAge}
                        onChange={(e) => setPatientAge(e.target.value)}
                      />
                      <ActionButton
                        variant="success"
                        fullWidth
                        disabled={registeringPatient || !account}
                        loading={registeringPatient}
                        onClick={registerAsPatient}
                      >
                        Register as Patient
                      </ActionButton>
                    </div>
                  </GlassCard>
                )}

                {canShowDoctorForm && (
                  <GlassCard glow="blue">
                    <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
                      <Stethoscope className="w-5 h-5 text-medical-blue" />
                      Register as Doctor
                    </h3>
                    <div className="space-y-4">
                      <InputField
                        label="Full Name"
                        placeholder="Enter your name"
                        value={doctorName}
                        onChange={(e) => setDoctorName(e.target.value)}
                      />
                      <InputField
                        label="Specialization"
                        placeholder="e.g., Cardiology"
                        value={doctorSpec}
                        onChange={(e) => setDoctorSpec(e.target.value)}
                      />
                      <ActionButton
                        variant="info"
                        fullWidth
                        disabled={registeringDoctor || !account}
                        loading={registeringDoctor}
                        onClick={registerAsDoctor}
                      >
                        Register as Doctor
                      </ActionButton>
                    </div>
                  </GlassCard>
                )}
              </div>
            </section>
          )}

        {/* Records Management */}
        {role !== "NONE" && (
          <section>
            <SectionHeader
              icon={<FileText className="w-5 h-5" />}
              title="Medical Records"
              description="Fetch and manage patient records stored on the blockchain."
            />
            <GlassCard>
              <div className="space-y-6">
                {/* Patient Address Input */}
                <div className="space-y-4">
                  <InputField
                    label="Patient Address"
                    hint="Enter the patient wallet address"
                    placeholder="0x..."
                    value={patientAddress}
                    onChange={(e) => setPatientAddress(e.target.value)}
                  />
                  <ActionButton
                    variant="success"
                    loading={loading}
                    disabled={loading || !account}
                    onClick={fetchRecords}
                  >
                    {loading ? "Loading..." : "Fetch Records"}
                  </ActionButton>
                </div>

                {/* Upload Section - Doctors Only */}
                {(role === "DOCTOR" || role === "BOTH") && (
                  <>
                    <div className="border-t border-border/50 pt-6">
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-4">
                        <Upload className="w-4 h-4" />
                        Upload New Record
                      </h4>
                      <div className="space-y-4">
                        <div className="relative">
                          <input
                            type="file"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setSelectedFile(e.target.files[0]);
                              }
                            }}
                            className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all"
                          />

                          <InputField
                            label="Filename"
                            placeholder="e.g. BloodTestReport.pdf"
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value)}
                          />

                          <InputField
                            label="Description"
                            placeholder="Short description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                          />
                        </div>
                        {selectedFile && (
                          <p className="text-sm text-muted-foreground">
                            Selected: <span className="text-foreground">{selectedFile.name}</span>
                          </p>
                        )}
                        <ActionButton
                          variant="info"
                          loading={uploading}
                          disabled={uploading || !account || !selectedFile}
                          onClick={uploadRecord}
                        >
                          {uploading ? "Uploading..." : "Upload to Blockchain"}
                        </ActionButton>
                      </div>
                    </div>
                  </>
                )}

                {role === "PATIENT" && (
                  <div className="border-t border-border/50 pt-6">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Only registered doctors can upload new medical records.
                    </p>
                  </div>
                )}
              </div>
            </GlassCard>
          </section>
        )}

        {/* Records List */}
        {role !== "NONE" && (
          <section>
            <SectionHeader
              icon={<FileText className="w-5 h-5" />}
              title="Records"
              description={
                records.length === 0
                  ? "No records loaded yet. Click Fetch Records."
                  : `Showing ${records.length} record(s)`
              }
            />
            {records.length > 0 && (
              <div className="space-y-4">
                {records.map((r, i) => (
                  <RecordCard
                    key={i}
                    cid={r.cid}
                    filename={r.filename}
                    description={r.description}
                    uploadedBy={r.uploadedBy}
                    timestamp={formatTimestamp(r.timestamp)}
                    index={i}
                    onView={() => handleViewFile(r.cid, r.encryptedKey, r.filename)}
                  />
                ))}
              </div>
            )}

            <div className="mt-6">
              <h2 className="text-xl font-semibold text-white mb-3">
                Audit Logs
              </h2>

              {auditLogs.length === 0 ? (
                <p className="text-gray-400">No audit logs found</p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log, index) => {
                    const args = log.args;

                    return (
                      <div
                        key={index}
                        className="bg-white/10 p-4 rounded-xl backdrop-blur"
                      >
                        <p className="text-sm text-white">
                          <strong>Patient:</strong> {args.patient}
                        </p>
                        <p className="text-sm text-white">
                          <strong>Doctor:</strong> {args.doctor}
                        </p>
                        <p className="text-sm text-white break-all">
                          <strong>CID:</strong> {args.cid}
                        </p>
                        <p className="text-sm text-white">
                          <strong>File:</strong> {args.filename}
                        </p>
                        <p className="text-sm text-gray-300">
                          <strong>Time:</strong>{" "}
                          {new Date(Number(args.timestamp) * 1000).toLocaleString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-16">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            Secured by blockchain technology • IPFS distributed storage
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
