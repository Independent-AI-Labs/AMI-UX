export const initialMessages = [
    {
        id: 1,
        conversationId: "conv_1",
        text: "**Neural interface initialized.** \n\n*System status: Online*\n\nHow may I assist you with your quantum computing research today?",
        sender: "ai",
        timestamp: new Date(Date.now() - 600000),
        q: 15,
        r: 7
    },
    {
        id: 2,
        conversationId: "conv_1", 
        text: "I need help understanding **quantum entanglement protocols** for secure communication systems. Can you explain the key implementation strategies?",
        sender: 'user',
        timestamp: new Date(Date.now() - 580000),
        q: 16,
        r: 7
    },
    {
        id: 3,
        conversationId: "conv_1",
        text: "Quantum entanglement protocols involve creating **correlated quantum states** between particles separated by arbitrary distances.\n\n**Key implementations include:**\n• Bell state measurement\n• Quantum teleportation sequences\n• Distributed quantum key generation\n\nThese enable *provably secure* communication channels through quantum mechanical properties.",
        sender: "ai",
        timestamp: new Date(Date.now() - 560000),
        q: 15,
        r: 8
    },
    {
        id: 4,
        conversationId: "conv_1",
        text: "That's fascinating! How do we handle **quantum decoherence** in practical implementations? I'm particularly interested in error correction methods.",
        sender: 'user',
        timestamp: new Date(Date.now() - 540000),
        q: 16,
        r: 8
    },
    {
        id: 5,
        conversationId: "conv_1",
        text: "**Quantum Error Correction (QEC)** is crucial for practical systems:\n\n**Surface Codes:**\n• Use 2D lattice of qubits\n• Detect both bit-flip and phase-flip errors\n• Threshold ~1% error rate\n\n**Stabilizer Codes:**\n• Encode logical qubits in physical qubit states\n• Enable fault-tolerant operations\n• Examples: Shor code, Steane code\n\n*Decoherence times* typically range from microseconds to milliseconds depending on the physical implementation.",
        sender: "ai",
        timestamp: new Date(Date.now() - 520000),
        q: 15,
        r: 9
    },
    {
        id: 6,
        conversationId: "conv_1",
        text: "What about **scalability challenges**? How do current quantum systems compare to classical distributed systems in terms of network topology and latency?",
        sender: 'user',
        timestamp: new Date(Date.now() - 500000),
        q: 16,
        r: 9
    },
    {
        id: 7,
        conversationId: "conv_1",
        text: "**Scalability remains a major challenge:**\n\n**Current Limitations:**\n• Limited qubit counts (100-1000 range)\n• High error rates (~0.1-1%)\n• Short coherence times\n\n**Network Topology:**\n• *Star configurations* for small networks\n• *Linear chains* for quantum repeaters\n• *Mesh topologies* for fault tolerance\n\n**Latency Comparison:**\n• Classical: ~1-100ms global\n• Quantum: Limited by light speed + processing\n• Quantum repeaters add ~10-100ms per hop\n\nThe **quantum internet** will likely use hybrid classical-quantum protocols for optimal performance.",
        sender: "ai",
        timestamp: new Date(Date.now() - 480000),
        q: 15,
        r: 10
    },
    {
        id: 8,
        conversationId: "conv_1",
        text: "Interesting! Can you provide some **concrete examples** of companies or research institutions that are successfully implementing these quantum communication protocols at scale?",
        sender: 'user',
        timestamp: new Date(Date.now() - 460000),
        q: 16,
        r: 10
    },
    {
        id: 9,
        conversationId: "conv_1",
        text: "**Leading Quantum Communication Implementations:**\n\n**Commercial Deployments:**\n• **ID Quantique** - Quantum key distribution networks in Geneva and Vienna\n• **Toshiba** - QKD links in UK and Japan (100+ km fiber)\n• **QuantumCTek** - Chinese quantum communication backbone\n\n**Research Institutions:**\n• **MIT Lincoln Lab** - Quantum internet testbed\n• **Delft University** - Quantum network node experiments\n• **University of Vienna** - Long-distance quantum teleportation\n\n**Recent Milestones:**\n• China's *Micius satellite* - 1200km quantum communication\n• European Quantum Internet Alliance - Multi-node networks\n• IBM Q Network - 20+ quantum computers accessible globally\nMost systems currently operate at **kilobit/second** rates with plans to reach megabit speeds by 2030.",
        sender: "ai",
        timestamp: new Date(Date.now() - 440000),
        q: 15,
        r: 11
    }
];

export const initialWebsites = [
    // Cluster 1: Reference sites (right side)
    {
        id: 'wiki-1',
        url: 'https://wikipedia.org',
        q: 25,
        r: 3
    },
    {
        id: 'archive-1',
        url: 'https://archive.org',
        q: 26,
        r: 3
    },
    {
        id: 'example-1',
        url: 'https://example.com',
        q: 25,
        r: 4
    },
    
    // Cluster 2: Development tools (left side)
    {
        id: 'codepen-1',
        url: 'https://codepen.io',
        q: 5,
        r: 3
    },
    {
        id: 'jsbin-1',
        url: 'https://jsbin.com',
        q: 6,
        r: 3
    },
    {
        id: 'httpbin-1',
        url: 'https://httpbin.org',
        q: 5,
        r: 4
    },
    
    // Cluster 3: Search engines (top area)
    {
        id: 'duckduckgo-1',
        url: 'https://duckduckgo.com',
        q: 14,
        r: 1
    },
    {
        id: 'startpage-1',
        url: 'https://startpage.com',
        q: 15,
        r: 1
    },
    {
        id: 'searx-1',
        url: 'https://searx.space',
        q: 16,
        r: 1
    }
];