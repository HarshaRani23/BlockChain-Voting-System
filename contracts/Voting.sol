// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Voting {
    struct Candidate {
        uint id;
        string name;
        string party;
        string imageHash;
        uint voteCount;
    }

    struct Voter {
        bool hasVoted;
        uint votedCandidateId;
        bool isRegistered;
    }

    mapping(uint => Candidate) public candidates;
    mapping(address => Voter) public voters;
    mapping(string => bool) public aadharUsed;
    
    uint public candidatesCount;
    address public admin;
    bool public votingOpen;

    event CandidateAdded(uint id, string name, string party);
    event VoterRegistered(address voter);
    event Voted(address voter, uint candidateId);
    event VotingStatusChanged(bool isOpen);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier votingIsOpen() {
        require(votingOpen, "Voting is not open");
        _;
    }

    constructor() {
        admin = msg.sender;
        votingOpen = false;
    }

    function addCandidate(string memory _name, string memory _party, string memory _imageHash) 
        public 
        onlyAdmin 
    {
        candidatesCount++;
        candidates[candidatesCount] = Candidate(
            candidatesCount,
            _name,
            _party,
            _imageHash,
            0
        );
        emit CandidateAdded(candidatesCount, _name, _party);
    }

    function registerVoter(address _voter, string memory _aadharNumber) 
        public 
        onlyAdmin 
    {
        require(!voters[_voter].isRegistered, "Voter already registered");
        require(!aadharUsed[_aadharNumber], "Aadhar already used");

        voters[_voter].isRegistered = true;
        aadharUsed[_aadharNumber] = true;
        
        emit VoterRegistered(_voter);
    }

    function vote(uint _candidateId) 
        public 
        votingIsOpen 
    {
        Voter storage sender = voters[msg.sender];
        
        require(sender.isRegistered, "Voter is not registered");
        require(!sender.hasVoted, "Already voted");
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate");

        sender.hasVoted = true;
        sender.votedCandidateId = _candidateId;
        candidates[_candidateId].voteCount++;

        emit Voted(msg.sender, _candidateId);
    }

    function startVoting() public onlyAdmin {
        votingOpen = true;
        emit VotingStatusChanged(true);
    }

    function stopVoting() public onlyAdmin {
        votingOpen = false;
        emit VotingStatusChanged(false);
    }

    function getCandidateDetails(uint _candidateId) 
        public 
        view 
        returns (string memory name, string memory party, string memory imageHash, uint voteCount) 
    {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate");
        Candidate memory candidate = candidates[_candidateId];
        return (candidate.name, candidate.party, candidate.imageHash, candidate.voteCount);
    }

    function getVoterStatus(address _voter) 
        public 
        view 
        returns (bool isRegistered, bool hasVoted, uint votedCandidateId) 
    {
        Voter memory voter = voters[_voter];
        return (voter.isRegistered, voter.hasVoted, voter.votedCandidateId);
    }
}