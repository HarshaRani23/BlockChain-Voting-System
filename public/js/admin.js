let web3;
let votingContract;

// Initialize Web3 and contract
async function initWeb3() {
    if (window.ethereum) {
        web3 = new Web3(window.ethereum);
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            const networkId = await web3.eth.net.getId();
            const contractData = await fetch('/contracts/Voting.json').then(res => res.json());
            votingContract = new web3.eth.Contract(
                contractData.abi,
                contractData.networks[networkId].address
            );
            return true;
        } catch (error) {
            console.error('User denied account access or wrong network');
            return false;
        }
    } else {
        console.error('No Web3 detected');
        return false;
    }
}

// Add candidate
async function addCandidate(event) {
    event.preventDefault();

    const name = document.getElementById('candidateName').value;
    const party = document.getElementById('candidateParty').value;
    const imageHash = document.getElementById('imageHash').value;

    try {
        const response = await fetch('/api/admin/add-candidate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('voterToken')}`
            },
            body: JSON.stringify({
                name,
                party,
                imageHash
            })
        });

        const data = await response.json();

        if (data.success) {
            alert('Candidate added successfully!');
            document.getElementById('addCandidateForm').reset();
            loadCandidates();
        } else {
            alert(data.message || 'Failed to add candidate');
        }
    } catch (error) {
        console.error('Error adding candidate:', error);
        alert('Error adding candidate. Please try again.');
    }
}

// Sync offline votes
async function syncOfflineVotes() {
    try {
        const response = await fetch('/api/admin/sync-votes', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('voterToken')}`
            }
        });

        const data = await response.json();

        if (data.success) {
            alert(`Synced ${data.syncedCount} out of ${data.totalCount} votes`);
            loadCandidates();
        } else {
            alert(data.message || 'Failed to sync votes');
        }
    } catch (error) {
        console.error('Error syncing votes:', error);
        alert('Error syncing votes. Please try again.');
    }
}

// Toggle voting status
async function toggleVoting() {
    try {
        const isOpen = await votingContract.methods.votingOpen().call();
        
        if (isOpen) {
            await votingContract.methods.stopVoting().send({ 
                from: ethereum.selectedAddress 
            });
        } else {
            await votingContract.methods.startVoting().send({ 
                from: ethereum.selectedAddress 
            });
        }
        
        alert(`Voting is now ${isOpen ? 'closed' : 'open'}`);
    } catch (error) {
        console.error('Error toggling voting status:', error);
        alert('Error changing voting status. Please try again.');
    }
}

// Initialize when page loads
window.addEventListener('load', async () => {
    if (!localStorage.getItem('voterToken') || localStorage.getItem('isAdmin') !== 'true') {
        window.location.href = '/';
        return;
    }

    await initWeb3();
    
    // Add event listeners
    document.getElementById('addCandidateForm').addEventListener('submit', addCandidate);
    document.getElementById('toggleVotingBtn').addEventListener('click', toggleVoting);
    document.getElementById('syncOfflineVotesBtn').addEventListener('click', syncOfflineVotes);
    
    loadCandidates();
});