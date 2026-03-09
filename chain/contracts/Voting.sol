// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract Voting {
    address public admin;

    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }

    uint256 public candidatesCount;
    mapping(uint256 => Candidate) public candidates;
    mapping(address => bool) public hasVoted;

    // receiptHash => recorded?
    mapping(bytes32 => bool) private receiptRecorded;

    event Voted(uint256 indexed candidateId);
    event ReceiptRecorded(bytes32 indexed receiptHash);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor(string[] memory names) {
        admin = msg.sender;

        require(names.length > 0, "No candidates");

        for (uint256 i = 0; i < names.length; i++) {
            candidatesCount++;

            candidates[candidatesCount] = Candidate({
                id: candidatesCount,
                name: names[i],
                voteCount: 0
            });
        }
    }

    // ---------- READ CANDIDATES ----------
    function getAllCandidates() external view returns (Candidate[] memory) {
        Candidate[] memory list = new Candidate[](candidatesCount);

        for (uint256 i = 1; i <= candidatesCount; i++) {
            list[i - 1] = candidates[i];
        }

        return list;
    }

    // ---------- VOTE ----------
    function vote(uint256 candidateId) external {
        require(!hasVoted[msg.sender], "Already voted");
        require(candidateId > 0 && candidateId <= candidatesCount, "Invalid candidate");

        hasVoted[msg.sender] = true;
        candidates[candidateId].voteCount++;

        emit Voted(candidateId);
    }

    // ---------- STORE RECEIPT HASH ----------
    function recordReceipt(bytes32 receiptHash) external onlyAdmin {
        require(receiptHash != bytes32(0), "Bad hash");
        require(!receiptRecorded[receiptHash], "Already recorded");

        receiptRecorded[receiptHash] = true;

        emit ReceiptRecorded(receiptHash);
    }

    // ---------- VERIFY RECEIPT ----------
    function isReceiptRecorded(bytes32 receiptHash)
        external
        view
        returns (bool)
    {
        return receiptRecorded[receiptHash];
    }
}