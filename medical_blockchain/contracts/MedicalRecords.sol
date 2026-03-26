// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MedicalRecords {

    struct Patient {
        string name;
        string gender;
        uint256 age;
        address wallet;
        bool exists;
    }

    struct Doctor {
        string name;
        string specialization;
        address wallet;
        bool exists;
    }

    struct Record {
        string cid;
        string filename;
        string description;
        string encryptedKey;
        uint256 timestamp;
        address uploadedBy;
    }


    mapping(address => Patient) public patients;
    mapping(address => Doctor) public doctors;
    mapping(address => Record[]) private medicalRecords;

    event PatientRegistered(address patient);
    event DoctorRegistered(address doctor);
    event RecordUploaded(
    address indexed patient,
    address indexed doctor,
    string cid,
    string filename,
    uint256 timestamp
    );


    modifier onlyDoctor() {
        require(doctors[msg.sender].exists, "Not doctor");
        _;
    }

    function registerPatient(
        string memory name,
        string memory gender,
        uint256 age
    ) public {
        require(!patients[msg.sender].exists, "Already patient");

        patients[msg.sender] = Patient(
            name,
            gender,
            age,
            msg.sender,
            true
        );

        emit PatientRegistered(msg.sender);
    }

    function registerDoctor(
        string memory name,
        string memory specialization
    ) public {
        require(!doctors[msg.sender].exists, "Already doctor");

        doctors[msg.sender] = Doctor(
            name,
            specialization,
            msg.sender,
            true
        );

        emit DoctorRegistered(msg.sender);
    }

    function uploadRecord(
        address patient,
        string memory cid,
        string memory filename,
        string memory description,
        string memory encryptedKey
    )
        public
        onlyDoctor
    {

        require(patients[patient].exists, "Patient not found");

        medicalRecords[patient].push(
            Record(
                cid,
                filename,
                description,
                encryptedKey,
                block.timestamp,
                msg.sender
            )
        );


        emit RecordUploaded(
            patient,
            msg.sender,
            cid,
            filename,
            block.timestamp
        );
    }

    function getRecords(address patient)
        public
        view
        returns (Record[] memory)
    {
        require(
            msg.sender == patient || doctors[msg.sender].exists,
            "Access denied"
        );

        return medicalRecords[patient];
    }
}
