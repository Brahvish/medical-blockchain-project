import { useEffect, useState } from "react";
import { ethers } from "ethers";
import axios from "axios";
import { CONTRACT_ADDRESS, MEDICAL_RECORDS_ABI } from "./blockchainConfig";

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
  timestamp: bigint;
  uploadedBy: string;
};


const ActionButton = ({
  label,
  disabled,
  loading,
  color,
  onClick,
}: {
  label: string;
  disabled: boolean;
  loading: boolean;
  color: string;
  onClick: () => void;
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "0.4rem 0.8rem",
        borderRadius: "999px",
        border: "none",
        background: disabled ? "#4b5563" : color,
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 600,
        fontSize: "0.9rem",
      }}
    >
      {loading ? "Processing..." : label}
    </button>
  );
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

  const res = await axios.post(url, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
      pinata_api_key: import.meta.env.VITE_PINATA_API_KEY,
      pinata_secret_api_key: import.meta.env.VITE_PINATA_SECRET_KEY,
    },
  });

  return res.data.IpfsHash;
};



function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Not connected");
  const [patientAddress, setPatientAddress] = useState<string>("");
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [role, setRole] = useState<UserRole>("NONE");

  // registration form states
  const [patientName, setPatientName] = useState<string>("");
  const [patientGender, setPatientGender] = useState<string>("");
  const [patientAge, setPatientAge] = useState<string>("");

  const [doctorName, setDoctorName] = useState<string>("");
  const [doctorSpec, setDoctorSpec] = useState<string>("");

  const [registeringPatient, setRegisteringPatient] = useState(false);
  const [registeringDoctor, setRegisteringDoctor] = useState(false);

  // helper: get contract instance
  const getContract = async () => {
    if (!window.ethereum) throw new Error("No MetaMask");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new ethers.Contract(CONTRACT_ADDRESS, MEDICAL_RECORDS_ABI, signer);
  };

  // role detection function
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

  // connect to MetaMask
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

  // fetch records for patientAddress
  const fetchRecords = async () => {
    try {
      if (!account) {
        alert("Connect your wallet first.");
        return;
      }

      // Unregistered cannot fetch
      if (role === "NONE") {
        const msg =
          "Please register as a patient or doctor to access medical records.";
        setStatus(msg);
        alert(msg);
        return;
      }

      if (!patientAddress) {
        alert("Enter a patient address first.");
        return;
      }

      // Patients can only view their own records
      if (
        role === "PATIENT" &&
        patientAddress.toLowerCase() !== account.toLowerCase()
      ) {
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
      cid: r.cid as string,
      filename: r.filename as string,
      description: r.description as string,
      timestamp: r.timestamp as bigint,
      uploadedBy: r.uploadedBy as string,
    }));

      setRecords(parsed);
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

  // upload new record CID for patientAddress
  const uploadRecord = async () => {
  try {
    if (!account) return alert("Connect wallet");
    if (role !== "DOCTOR" && role !== "BOTH")
      return alert("Only doctor can upload");

    if (!patientAddress) return alert("Enter patient address");
    
    if (!ethers.isAddress(patientAddress.trim())) {
      alert("Invalid patient address");
      return;
    }
    if (!selectedFile) return alert("Select a file");

    setUploading(true);
    setStatus("Uploading file to IPFS...");

    const cid = await uploadFileToIPFS(selectedFile);

    setStatus("Saving CID on blockchain...");

    const contract = await getContract();
    const tx = await contract.uploadRecord(
      patientAddress,
      cid,
      fileName,
      description
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


  // register as patient
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
      const tx = await contract.registerPatient(
        patientName.trim(),
        patientGender.trim(),
        ageNum
      );
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

  // register as doctor
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

      const tx = await contract.registerDoctor(
        doctorName.trim(),
        doctorSpec.trim()
      );
      await tx.wait();

      setStatus("Registered as doctor successfully.");
      await detectRole(account);
    } catch (error: any) {
      console.error(error);
      const rawMessage =
        error?.reason ||
        error?.data?.message ||
        error?.message ||
        "Error registering as doctor";
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

  // Auto-update account + role when user switches MetaMask accounts
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
        window.ethereum.removeListener(
          "accountsChanged",
          handleAccountsChanged
        );
      }
    };
  }, []);

  // --- UI blocks for different roles ---
  const UnregisteredView = () => (
    <div style={{ marginBottom: "1rem" }}>
      <h2 style={{ fontSize: "1.2rem", marginBottom: "0.3rem" }}>
        🧾 Registration Required
      </h2>
      <p style={{ color: "#9ca3af" }}>
        Please register as a patient or doctor to access medical records.
      </p>
    </div>
  );

  const PatientView = () => (
    <div style={{ marginBottom: "1rem" }}>
      <h2 style={{ fontSize: "1.2rem", marginBottom: "0.3rem" }}>
        🧍 Patient Dashboard
      </h2>
      <p style={{ color: "#9ca3af" }}>
        You can view your own medical records. Uploading is restricted to
        doctors.
      </p>
    </div>
  );

  const DoctorView = () => (
    <div style={{ marginBottom: "1rem" }}>
      <h2 style={{ fontSize: "1.2rem", marginBottom: "0.3rem" }}>
        🩺 Doctor Dashboard
      </h2>
      <p style={{ color: "#9ca3af" }}>
        You can view and upload medical records for registered patients.
      </p>
    </div>
  );

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

  // Who can see which registration forms
  // - NONE: can see both forms
  // - DOCTOR: can add patient role
  // - PATIENT: cannot register as doctor
  // - BOTH: no registration needed
  const canShowPatientForm = role === "NONE" || role === "DOCTOR";
  const canShowDoctorForm = role === "NONE";


  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "white",
        padding: "2rem 0",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          background: "#020617",
          borderRadius: "0",
          padding: "1.5rem 2rem",
          border: "none",
          borderTop: "1px solid #1e293b",
          borderBottom: "1px solid #1e293b",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
        }}
      >
        <h1 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>
          🩺 Medical Records DApp
        </h1>
        <p style={{ color: "#9ca3af", marginBottom: "1.25rem" }}>
          Frontend for your <code>MedicalRecords</code> smart contract.
        </p>

        {/* Connection box */}
        <div
          style={{
            padding: "1rem",
            borderRadius: "0.75rem",
            background: "#020617",
            border: "1px solid #1e293b",
            marginBottom: "1.5rem",
          }}
        >
          <p>
            <strong>Status:</strong> {status}
          </p>
          <p>
            <strong>Connected as:</strong>{" "}
            {account ? (
              <span title={account}>{shortenAddress(account)}</span>
            ) : (
              "Not connected"
            )}
          </p>

          {/* Role badge */}
          <p style={{ marginTop: "0.5rem" }}>
            <strong>Role:</strong>{" "}
            {!account ? (
              <span style={{ color: "#9ca3af" }}>—</span>
            ) : role === "NONE" ? (
              <span
                style={{
                  padding: "0.15rem 0.6rem",
                  borderRadius: "999px",
                  border: "1px solid #4b5563",
                  fontSize: "0.8rem",
                  color: "#e5e7eb",
                }}
              >
                Unregistered
              </span>
            ) : role === "PATIENT" ? (
              <span
                style={{
                  padding: "0.15rem 0.6rem",
                  borderRadius: "999px",
                  border: "1px solid #22c55e",
                  fontSize: "0.8rem",
                  color: "#bbf7d0",
                }}
              >
                🧍 Patient
              </span>
            ) : role === "DOCTOR" ? (
              <span
                style={{
                  padding: "0.15rem 0.6rem",
                  borderRadius: "999px",
                  border: "1px solid #3b82f6",
                  fontSize: "0.8rem",
                  color: "#bfdbfe",
                }}
              >
                🩺 Doctor
              </span>
            ) : (
              <span
                style={{
                  padding: "0.15rem 0.6rem",
                  borderRadius: "999px",
                  border: "1px solid #a855f7",
                  fontSize: "0.8rem",
                  color: "#e9d5ff",
                }}
              >
                🧍 Patient & 🩺 Doctor
              </span>
            )}
          </p>

          <div
            style={{
              marginTop: "0.75rem",
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={connectWallet}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "999px",
                border: "none",
                background: "#3b82f6",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {account ? "Reconnect" : "Connect MetaMask"}
            </button>

            {account && (
              <>
                <ActionButton
                  label="Copy address"
                  disabled={false}
                  loading={false}
                  color="#4b5563"
                  onClick={handleCopyAddress}
                />
                <ActionButton
                  label="Use my address as patient"
                  disabled={false}
                  loading={false}
                  color="#22c55e"
                  onClick={handleUseMyAddress}
                />
              </>
            )}
          </div>
        </div>

        {/* Role-based header view */}
        {role === "NONE" && <UnregisteredView />}
        {role === "PATIENT" && <PatientView />}
        {(role === "DOCTOR" || role === "BOTH") && <DoctorView />}

        {/* Registration forms – now allow adding a second role */}
        {(role === "NONE" || role === "PATIENT" || role === "DOCTOR") && (
          <div
            style={{
              padding: "1rem",
              borderRadius: "0.75rem",
              background: "#020617",
              border: "1px solid #1e293b",
              marginBottom: "1.5rem",
            }}
          >
            <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>
              🧾 Registration
            </h2>
            <p style={{ color: "#9ca3af", marginBottom: "1rem" }}>
              Register the connected wallet as a patient or a doctor.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              {/* Patient registration */}
              {canShowPatientForm && (
                <div
                  style={{
                    padding: "0.75rem",
                    borderRadius: "0.75rem",
                    background: "#020617",
                    border: "1px solid #1e293b",
                  }}
                >
                  <h3 style={{ marginBottom: "0.5rem" }}>
                    🧍 Register as Patient
                  </h3>
                  <input
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Name"
                    style={{
                      width: "100%",
                      padding: "0.4rem 0.6rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #374151",
                      background: "#020617",
                      color: "white",
                      marginBottom: "0.4rem",
                    }}
                  />
                  <input
                    value={patientGender}
                    onChange={(e) => setPatientGender(e.target.value)}
                    placeholder="Gender"
                    style={{
                      width: "100%",
                      padding: "0.4rem 0.6rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #374151",
                      background: "#020617",
                      color: "white",
                      marginBottom: "0.4rem",
                    }}
                  />
                  <input
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value)}
                    placeholder="Age"
                    type="number"
                    style={{
                      width: "100%",
                      padding: "0.4rem 0.6rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #374151",
                      background: "#020617",
                      color: "white",
                      marginBottom: "0.6rem",
                    }}
                  />
                  <ActionButton
                    label="Register Patient"
                    disabled={registeringPatient || !account}
                    loading={registeringPatient}
                    color="#22c55e"
                    onClick={registerAsPatient}
                  />
                </div>
              )}

              {/* Doctor registration */}
              {canShowDoctorForm && (
                <div
                  style={{
                    padding: "0.75rem",
                    borderRadius: "0.75rem",
                    background: "#020617",
                    border: "1px solid #1e293b",
                  }}
                >
                  <h3 style={{ marginBottom: "0.5rem" }}>
                    🩺 Register as Doctor
                  </h3>
                  <input
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    placeholder="Name"
                    style={{
                      width: "100%",
                      padding: "0.4rem 0.6rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #374151",
                      background: "#020617",
                      color: "white",
                      marginBottom: "0.4rem",
                    }}
                  />
                  <input
                    value={doctorSpec}
                    onChange={(e) => setDoctorSpec(e.target.value)}
                    placeholder="Specialization"
                    style={{
                      width: "100%",
                      padding: "0.4rem 0.6rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #374151",
                      background: "#020617",
                      color: "white",
                      marginBottom: "0.6rem",
                    }}
                  />
                  <ActionButton
                    label="Register Doctor"
                    disabled={registeringDoctor || !account}
                    loading={registeringDoctor}
                    color="#3b82f6"
                    onClick={registerAsDoctor}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Patient input + fetch button */}
        {role !== "NONE" && (
          <div
            style={{
              padding: "1rem",
              borderRadius: "0.75rem",
              background: "#020617",
              border: "1px solid #1e293b",
              marginBottom: "1.5rem",
            }}
          >
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              <strong>Patient address</strong>{" "}
              <span style={{ color: "#9ca3af" }}>
                (use the patient address you seeded records for)
              </span>
            </label>
            <input
              value={patientAddress}
              onChange={(e) => setPatientAddress(e.target.value)}
              placeholder="0x..."
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #374151",
                background: "#020617",
                color: "white",
                marginBottom: "0.75rem",
              }}
            />
            <ActionButton
              label={loading ? "Loading..." : "Fetch Records"}
              disabled={loading || !account}
              loading={loading}
              color="#22c55e"
              onClick={fetchRecords}
            />

            {/* Upload section – only for doctors */}
            {role === "DOCTOR" || role === "BOTH" ? (
              <>
                <hr
                  style={{
                    margin: "1rem 0",
                    borderColor: "#1e293b",
                  }}
                />
                <label style={{ display: "block", marginBottom: "0.5rem" }}>
                  <strong>New record CID</strong>{" "}
                  <span style={{ color: "#9ca3af" }}>
                    (doctor uploads encrypted file pointer)
                  </span>
                </label>
                <input
                  type="file"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #374151",
                    background: "#020617",
                    color: "white",
                    marginBottom: "0.75rem",
                  }}
                />

                <input
                  type="text"
                  placeholder="Enter filename"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #374151",
                    background: "#020617",
                    color: "white",
                    marginBottom: "0.75rem",
                  }}
                />

                <textarea
                  placeholder="Enter description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #374151",
                    background: "#020617",
                    color: "white",
                    marginBottom: "0.75rem",
                  }}
                />


                <ActionButton
                  label={uploading ? "Uploading..." : "Upload Record"}
                  disabled={uploading || !account}
                  loading={uploading}
                  color="#3b82f6"
                  onClick={uploadRecord}
                />
              </>
            ) : (
              <>
                <hr
                  style={{
                    margin: "1rem 0",
                    borderColor: "#1e293b",
                  }}
                />
                <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
                  Only a registered doctor can upload new medical records.
                </p>
              </>
            )}
          </div>
        )}

        {/* Records list – only for registered users */}
        {role !== "NONE" && (
          <div>
            <h2 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>
              📚 Records
            </h2>
            {records.length === 0 ? (
              <p style={{ color: "#9ca3af" }}>
                No records loaded yet. Click <strong>Fetch Records</strong>.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {records.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "0.75rem",
                      background: "#020617",
                      border: "1px solid #1e293b",
                    }}
                  >
                    <div>
                      <strong>{r.filename}</strong>
                    </div>

                    <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
                      {r.description}
                    </div>

                    <div>
                      <strong>CID:</strong> {r.cid}
                    </div>


                    <a
                      href={`https://gateway.pinata.cloud/ipfs/${r.cid}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#60a5fa" }}
                    >
                      Open File
                    </a>
                    <div style={{ fontSize: "0.9rem", color: "#9ca3af" }}>
                      <div>
                        <strong>Uploaded by:</strong> {shortenAddress(r.uploadedBy)}
                      </div>
                      <div>
                        <strong>Timestamp:</strong>{" "}
                        {formatTimestamp(r.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;