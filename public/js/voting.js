let web3;
let votingContract;
let isOnline = navigator.onLine;

// Initialize Web3 and contract
async function initWeb3() {
    if (window.ethereum) {
        web3 = new Web3(window.ethereum);
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            const networkId = await web3.eth.net.getId();
            const contractData = await fetch('/contracts/Voting.json').then(
                (res) => res.json()
            );
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

// Load candidates
async function loadCandidates() {
    try {
        const response = await fetch('/api/candidates', {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('voterToken')}`,
            },
        });
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message);
        }

        const container = document.getElementById('candidatesContainer');
        container.innerHTML = data.candidates
            .map(
                (candidate) => `
                <div class="col-md-4 mb-4">
                    <div class="card candidate-card">
                        <div class="card-body">
                            <h5 class="card-title">${candidate.name}</h5>
                            <span class="party-badge">${candidate.party}</span>
                            <p class="vote-count">Votes: ${candidate.vote_count}</p>
                            <button onclick="castVote(${candidate.id})" 
                                    class="btn btn-primary w-100">
                                Vote
                            </button>
                        </div>
                    </div>
                </div>
            `
            )
            .join('');
    } catch (error) {
        console.error('Error loading candidates:', error);
        alert('Error loading candidates. Please try again.');
    }
}

// Cast vote
async function castVote(candidateId) {
    try {
        const response = await fetch('/api/cast-vote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('voterToken')}`,
            },
            body: JSON.stringify({
                candidateId,
                aadharNumber: localStorage.getItem('aadharNumber'),
            }),
        });

        const data = await response.json();

        if (data.success) {
            alert('Vote cast successfully!');
            loadCandidates();
        } else {
            alert(data.message || 'Failed to cast vote');
        }
    } catch (error) {
        console.error('Error casting vote:', error);
        alert('Error casting vote. Please try again.');
    }
}

// Update connection status
function updateConnectionStatus() {
    const status = document.getElementById('connectionStatus');
    status.textContent = isOnline ? 'Online' : 'Offline';
    status.className = `badge ${
        isOnline ? 'connection-online' : 'connection-offline'
    }`;
}

// Connection event listeners
window.addEventListener('online', () => {
    isOnline = true;
    updateConnectionStatus();
});

window.addEventListener('offline', () => {
    isOnline = false;
    updateConnectionStatus();
});

// Initialize when page loads
window.addEventListener('load', async () => {
    if (!localStorage.getItem('voterToken')) {
        window.location.href = '/';
        return;
    }

    updateConnectionStatus();
    await initWeb3();
    loadCandidates();
});
