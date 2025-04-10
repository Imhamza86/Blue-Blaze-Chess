document.addEventListener('DOMContentLoaded', () => {
    // Simulate loading
    const loadingScreen = document.getElementById('loadingScreen');
    const loadingProgress = document.querySelector('.loading-progress');
    const gameContainer = document.getElementById('gameContainer');
    
    // Show loading screen immediately
    loadingScreen.style.display = 'flex';
    
    let progress = 0;
    const loadingInterval = setInterval(() => {
        progress += Math.random() * 10;
        if (progress >= 100) {
            progress = 100;
            clearInterval(loadingInterval);
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                    gameContainer.style.display = 'block';
                    setTimeout(() => {
                        gameContainer.style.opacity = '1';
                        initGame();
                    }, 100);
                }, 1000);
            }, 500);
        }
        loadingProgress.style.width = `${progress}%`;
    }, 200);
});

function initGame() {
    // Game state
    const game = new Chess();
    let selectedSquare = null;
    let moveHistory = [];
    let aiThinking = false;
    let promotionMove = null;
    
    // DOM elements
    const chessBoard = document.getElementById('chessBoard');
    const moveList = document.getElementById('moveList');
    const playerStatus = document.getElementById('playerStatus');
    const aiStatus = document.getElementById('aiStatus');
    const newGameBtn = document.getElementById('newGameBtn');
    const undoBtn = document.getElementById('undoBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const aiLevel = document.getElementById('aiLevel');
    const promotionModal = document.getElementById('promotionModal');
    const promotionOptions = document.querySelectorAll('.promotion-option');
    const gameOverModal = document.getElementById('gameOverModal');
    const gameOutcomeText = document.getElementById('gameOutcomeText');
    const gameOutcomeDescription = document.getElementById('gameOutcomeDescription');
    const playAgainBtn = document.getElementById('playAgainBtn');
    const mainMenuBtn = document.getElementById('mainMenuBtn');
    const settingsModal = document.getElementById('settingsModal');
    const soundVolume = document.getElementById('soundVolume');
    const musicVolume = document.getElementById('musicVolume');
    const animationSpeed = document.getElementById('animationSpeed');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
    
    // Audio elements
    const moveSound = document.getElementById('moveSound');
    const captureSound = document.getElementById('captureSound');
    const checkSound = document.getElementById('checkSound');
    const victorySound = document.getElementById('victorySound');
    const defeatSound = document.getElementById('defeatSound');
    const backgroundMusic = document.getElementById('backgroundMusic');
    
    // Initialize Stockfish AI (using local worker)
    const stockfish = new Worker('stockfish.js');
    stockfish.addEventListener('message', handleStockfishMessage);
    
    // Settings
    let settings = {
        soundVolume: 70,
        musicVolume: 50,
        animationSpeed: 3
    };
    
    // Load settings from localStorage
    if (localStorage.getItem('blueBlazeChessSettings')) {
        settings = JSON.parse(localStorage.getItem('blueBlazeChessSettings'));
        soundVolume.value = settings.soundVolume;
        musicVolume.value = settings.musicVolume;
        animationSpeed.value = settings.animationSpeed;
        updateAudioVolumes();
    }
    
    // Initialize the board
    function initBoard() {
        // Clear the board
        chessBoard.innerHTML = '';
        
        // Create 8x8 board
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const square = document.createElement('div');
                square.className = `square ${(i + j) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = i;
                square.dataset.col = j;
                square.dataset.square = `${String.fromCharCode(97 + j)}${8 - i}`;
                
                square.addEventListener('click', () => handleSquareClick(square));
                
                // Add drag and drop events
                square.addEventListener('dragover', (e) => e.preventDefault());
                square.addEventListener('drop', (e) => handleDrop(e, square));
                
                chessBoard.appendChild(square);
            }
        }
        
        updateBoard();
    }
    
    // Update the board based on current game state
    function updateBoard() {
        // Clear all pieces and highlights
        document.querySelectorAll('.square').forEach(square => {
            square.innerHTML = '';
            square.classList.remove('highlight', 'selected', 'last-move', 'check');
        });
        
        // Highlight last move if available
        if (moveHistory.length > 0) {
            const lastMove = moveHistory[moveHistory.length - 1];
            const fromSquare = document.querySelector(`[data-square="${lastMove.from}"]`);
            const toSquare = document.querySelector(`[data-square="${lastMove.to}"]`);
            
            if (fromSquare) fromSquare.classList.add('last-move');
            if (toSquare) toSquare.classList.add('last-move');
        }
        
        // Highlight king in check
        const kingSquare = game.turn() === 'w' ? game.board().flat().find(sq => sq && sq.type === 'k' && sq.color === 'w') 
                                               : game.board().flat().find(sq => sq && sq.type === 'k' && sq.color === 'b');
        
        if (kingSquare) {
            const kingPos = game.board().flat().indexOf(kingSquare);
            const row = Math.floor(kingPos / 8);
            const col = kingPos % 8;
            const squareNotation = `${String.fromCharCode(97 + col)}${8 - row}`;
            const squareElement = document.querySelector(`[data-square="${squareNotation}"]`);
            
            if (squareElement && game.in_check()) {
                squareElement.classList.add('check');
            }
        }
        
        // Place pieces on the board
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const piece = game.board()[i][j];
                const square = document.querySelector(`[data-square="${String.fromCharCode(97 + j)}${8 - i}"]`);
                
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = `piece ${piece.color === 'w' ? 'white' : 'black'}`;
                    pieceElement.dataset.piece = `${piece.color}${piece.type}`;
                    pieceElement.draggable = piece.color === game.turn();
                    
                    // Set piece SVG based on type and color
                    pieceElement.innerHTML = getPieceSVG(piece.type, piece.color);
                    
                    // Add drag events
                    pieceElement.addEventListener('dragstart', (e) => handleDragStart(e, pieceElement));
                    
                    square.appendChild(pieceElement);
                }
            }
        }
        
        // Update status
        updateGameStatus();
    }
    
    // Get SVG for a piece
    function getPieceSVG(type, color) {
        const isWhite = color === 'w';
        const baseColor = isWhite ? "#ffffff" : "#333333";
        const highlightColor = "#00bfff";
        
        switch (type) {
            case 'p': // Pawn
                return `
                    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="50" cy="30" r="15" fill="${baseColor}" stroke="${highlightColor}" stroke-width="2"/>
                        <rect x="40" y="45" width="20" height="25" fill="${baseColor}" stroke="${highlightColor}" stroke-width="2"/>
                        <path d="M35 70 L65 70 L60 90 L40 90 Z" fill="${baseColor}" stroke="${highlightColor}" stroke-width="2"/>
                        <rect x="47" y="30" width="6" height="40" fill="${highlightColor}"/>
                    </svg>
                `;
            case 'n': // Knight
                return `
                    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                        <path d="M30 30 Q50 10 70 30 Q80 40 75 50 Q85 60 70 70 Q60 80 50 75 Q40 90 30 80 Z" fill="${baseColor}" stroke="${highlightColor}" stroke-width="2"/>
                        <circle cx="40" cy="40" r="5" fill="${highlightColor}"/>
                        <path d="M60 40 L70 30" stroke="${highlightColor}" stroke-width="3" stroke-linecap="round"/>
                    </svg>
                `;
            case 'b': // Bishop
                return `
                    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="50" cy="25" r="10" fill="${baseColor}" stroke="${highlightColor}" stroke-width="2"/>
                        <path d="M40 35 L60 35 L55 80 L45 80 Z" fill="${baseColor}" stroke="${highlightColor}" stroke-width="2"/>
                        <rect x="30" y="80" width="40" height="15" fill="${baseColor}" stroke="${highlightColor}" stroke-width="2"/>
                        <path d="M50 35 L50 60" stroke="${highlightColor}" stroke-width="3"/>
                        <circle cx="50" cy="65" r="5" fill="${highlightColor}"/>
                    </svg>
                `;
            case 'r': // Rook
                return `
                    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                        <rect x="30" y="20" width="40" height="20" fill="${baseColor}" stroke="${highlightColor}" stroke-width="2"/>
                        <rect x="35" y="40" width="30" height="40" fill="${baseColor}" stroke="${highlightColor}" stroke-width="2"/>
                        <rect x="20" y="80" width="60" height="15" fill="${baseColor}" stroke="${highlightColor}" stroke-width="2"/>
                        <rect x="40" y="30" width="5" height="10" fill="${highlightColor}"/>
                        <rect x="55" y="30" width="5" height="10" fill="${highlightColor}"/>
                    </svg>
                `;
            case 'q': // Queen
                return `
                    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="50" cy="25" r="15" fill="${baseColor}" stroke="${highlightColor}" stroke-width="2"/>
                        <path d="M35 40 L65 40 L60 80 L40 80 Z" fill="${baseColor}" stroke="${highlightColor}" stroke-width="2"/>
                        <rect x="25" y="80" width="50" height="15" fill="${baseColor}" stroke="${highlightColor}" stroke-width="2"/>
                        <circle cx="50" cy="35" r="5" fill="${highlightColor}"/>
                        <circle cx="40" cy="30" r="3" fill="${highlightColor}"/>
                        <circle cx="60" cy="30" r="3" fill="${highlightColor}"/>
                        <path d="M50 45 L50 65" stroke="${highlightColor}" stroke-width="3"/>
                    </svg>
                `;
            case 'k': // King
                return `
                    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                        <rect x="35" y="20" width="30" height="20" fill="${baseColor}" stroke="${highlightColor}" stroke-width="2"/>
                        <path d="M50 20 L50 10 L55 15 L60 10 L60 20" fill="${baseColor}" stroke="${highlightColor}" stroke-width="2"/>
                        <rect x="40" y="40" width="20" height="40" fill="${baseColor}" stroke="${highlightColor}" stroke-width="2"/>
                        <rect x="25" y="80" width="50" height="15" fill="${baseColor}" stroke="${highlightColor}" stroke-width="2"/>
                        <path d="M40 30 L60 30" stroke="${highlightColor}" stroke-width="3"/>
                        <path d="M45 35 L55 35" stroke="${highlightColor}" stroke-width="3"/>
                        <path d="M50 45 L50 65" stroke="${highlightColor}" stroke-width="3"/>
                    </svg>
                `;
            default:
                return '';
        }
    }
    
    // Handle square click
    function handleSquareClick(square) {
        if (aiThinking || game.game_over()) return;
        
        const squareNotation = square.dataset.square;
        const piece = game.get(squareNotation);
        
        // If a square is already selected
        if (selectedSquare) {
            // If clicking on the same square, deselect it
            if (selectedSquare === squareNotation) {
                clearSelection();
                return;
            }
            
            // If clicking on another piece of the same color, select that piece instead
            if (piece && piece.color === game.turn()) {
                selectSquare(squareNotation);
                return;
            }
            
            // Try to make a move
            const move = {
                from: selectedSquare,
                to: squareNotation,
                promotion: 'q' // Default to queen, will be changed if needed
            };
            
            tryMove(move);
        } 
        // If no square is selected and this square has a piece of the current turn's color
        else if (piece && piece.color === game.turn()) {
            selectSquare(squareNotation);
        }
    }
    
    // Select a square and show available moves
    function selectSquare(squareNotation) {
        clearSelection();
        
        selectedSquare = squareNotation;
        const squareElement = document.querySelector(`[data-square="${squareNotation}"]`);
        squareElement.classList.add('selected');
        
        // Highlight possible moves
        const moves = game.moves({
            square: squareNotation,
            verbose: true
        });
        
        moves.forEach(move => {
            const targetSquare = document.querySelector(`[data-square="${move.to}"]`);
            if (targetSquare) {
                targetSquare.classList.add('highlight');
                
                // Add ripple effect
                const ripple = document.createElement('div');
                ripple.className = 'ripple-effect';
                targetSquare.appendChild(ripple);
                
                setTimeout(() => {
                    ripple.remove();
                }, 600);
            }
        });
    }
    
    // Clear selection and highlights
    function clearSelection() {
        if (selectedSquare) {
            const squareElement = document.querySelector(`[data-square="${selectedSquare}"]`);
            if (squareElement) squareElement.classList.remove('selected');
        }
        
        document.querySelectorAll('.highlight').forEach(el => {
            el.classList.remove('highlight');
        });
        
        selectedSquare = null;
    }
    
    // Try to make a move
    function tryMove(move) {
        const legalMove = game.move(move);
        
        if (legalMove) {
            // Play sound
            if (legalMove.captured) {
                playSound(captureSound);
            } else {
                playSound(moveSound);
            }
            
            // Add to move history
            moveHistory.push({
                from: legalMove.from,
                to: legalMove.to,
                piece: legalMove.piece,
                captured: legalMove.captured,
                flags: legalMove.flags
            });
            
            updateMoveHistory();
            updateBoard();
            
            // Check for game over
            if (game.game_over()) {
                handleGameOver();
                return;
            }
            
            // If pawn promotion is needed
            if (legalMove.flags.includes('p') && !legalMove.promotion) {
                promotionMove = legalMove;
                showPromotionModal();
                return;
            }
            
            // AI's turn
            if (game.turn() === 'b') {
                makeAIMove();
            }
        } else {
            // Invalid move
            clearSelection();
        }
    }
    
    // Handle drag start
    function handleDragStart(e, pieceElement) {
        if (aiThinking || game.game_over()) {
            e.preventDefault();
            return;
        }
        
        const square = pieceElement.parentElement;
        const squareNotation = square.dataset.square;
        const piece = game.get(squareNotation);
        
        if (piece && piece.color === game.turn()) {
            e.dataTransfer.setData('text/plain', squareNotation);
            pieceElement.classList.add('dragging');
            
            // Select the piece and show moves
            selectSquare(squareNotation);
        } else {
            e.preventDefault();
        }
    }
    
    // Handle drop
    function handleDrop(e, square) {
        e.preventDefault();
        
        if (aiThinking || game.game_over()) return;
        
        const fromSquare = e.dataTransfer.getData('text/plain');
        const toSquare = square.dataset.square;
        const pieceElement = document.querySelector(`[data-square="${fromSquare}"] .piece`);
        
        if (pieceElement) {
            pieceElement.classList.remove('dragging');
        }
        
        if (fromSquare === toSquare) {
            clearSelection();
            return;
        }
        
        const move = {
            from: fromSquare,
            to: toSquare,
            promotion: 'q' // Default to queen
        };
        
        tryMove(move);
    }
    
    // Update move history display
    function updateMoveHistory() {
        moveList.innerHTML = '';
        
        for (let i = 0; i < moveHistory.length; i += 2) {
            const moveItem = document.createElement('div');
            moveItem.className = 'move-item';
            
            const moveNumber = document.createElement('span');
            moveNumber.className = 'move-number';
            moveNumber.textContent = `${i / 2 + 1}.`;
            
            const moveWhite = document.createElement('span');
            moveWhite.className = 'move-white';
            moveWhite.textContent = moveToNotation(moveHistory[i]);
            
            let moveBlack = '';
            if (i + 1 < moveHistory.length) {
                moveBlack = document.createElement('span');
                moveBlack.className = 'move-black';
                moveBlack.textContent = moveToNotation(moveHistory[i + 1]);
            }
            
            moveItem.appendChild(moveNumber);
            moveItem.appendChild(moveWhite);
            if (moveBlack) moveItem.appendChild(moveBlack);
            
            moveList.appendChild(moveItem);
        }
        
        // Scroll to bottom
        moveList.scrollTop = moveList.scrollHeight;
    }
    
    // Convert move to notation
    function moveToNotation(move) {
        if (move.flags.includes('k')) {
            return move.to === 'g1' || move.to === 'g8' ? 'O-O' : 'O-O-O';
        }
        
        let notation = '';
        
        // Piece type (except pawn)
        if (move.piece !== 'p') {
            notation += move.piece.toUpperCase();
        }
        
        // Capture
        if (move.captured) {
            if (move.piece === 'p') {
                notation += move.from[0]; // File of pawn
            }
            notation += 'x';
        }
        
        // Destination
        notation += move.to;
        
        // Promotion
        if (move.flags.includes('p')) {
            notation += '=' + (move.promotion?.toUpperCase() || 'Q');
        }
        
        // Check/checkmate
        if (game.in_checkmate()) {
            notation += '#';
        } else if (game.in_check()) {
            notation += '+';
        }
        
        return notation;
    }
    
    // Update game status display
    function updateGameStatus() {
        if (game.game_over()) {
            if (game.in_checkmate()) {
                playerStatus.textContent = game.turn() === 'w' ? 'DEFEATED' : 'VICTORIOUS';
                aiStatus.textContent = game.turn() === 'b' ? 'DEFEATED' : 'VICTORIOUS';
            } else {
                playerStatus.textContent = 'DRAW';
                aiStatus.textContent = 'DRAW';
            }
            return;
        }
        
        if (game.turn() === 'w') {
            playerStatus.textContent = 'YOUR TURN';
            aiStatus.textContent = 'THINKING...';
        } else {
            playerStatus.textContent = 'WAITING...';
            aiStatus.textContent = 'AI THINKING';
        }
        
        if (game.in_check()) {
            playSound(checkSound);
            
            const checkStatus = game.turn() === 'w' ? playerStatus : aiStatus;
            checkStatus.textContent = 'IN CHECK!';
        }
    }
    
    // Make AI move using Stockfish
    function makeAIMove() {
        if (game.game_over()) return;
        
        aiThinking = true;
        aiStatus.textContent = 'THINKING...';
        
        // Set difficulty level
        const level = parseInt(aiLevel.value);
        let depth = 5;
        
        switch (level) {
            case 1: depth = 1; break; // Beginner
            case 2: depth = 3; break; // Intermediate
            case 3: depth = 5; break; // Advanced
            case 4: depth = 8; break; // Expert
        }
        
        // Send position to Stockfish
        stockfish.postMessage(`position fen ${game.fen()}`);
        stockfish.postMessage(`go depth ${depth}`);
    }
    
    // Handle Stockfish response
    function handleStockfishMessage(e) {
        if (!e.data || !aiThinking) return;
        
        const message = e.data;
        
        if (message.startsWith('bestmove')) {
            const bestMove = message.split(' ')[1];
            
            if (bestMove && bestMove !== '(none)') {
                // Convert from Stockfish's move format to chess.js format
                const from = bestMove.substring(0, 2);
                const to = bestMove.substring(2, 4);
                let promotion = null;
                
                if (bestMove.length > 4) {
                    promotion = bestMove.substring(4, 5);
                }
                
                const move = {
                    from: from,
                    to: to,
                    promotion: promotion
                };
                
                // Add slight delay for more natural feel
                setTimeout(() => {
                    tryMove(move);
                    aiThinking = false;
                }, 500);
            }
        }
    }
    
    // Show promotion modal
    function showPromotionModal() {
        if (!promotionMove) return;
        
        promotionModal.style.display = 'flex';
        setTimeout(() => {
            promotionModal.style.opacity = '1';
        }, 10);
    }
    
    // Hide promotion modal
    function hidePromotionModal() {
        promotionModal.style.opacity = '0';
        setTimeout(() => {
            promotionModal.style.display = 'none';
        }, 300);
    }
    
    // Handle promotion selection
    promotionOptions.forEach(option => {
        option.addEventListener('click', () => {
            if (!promotionMove) return;
            
            const piece = option.dataset.piece;
            const move = {
                from: promotionMove.from,
                to: promotionMove.to,
                promotion: piece
            };
            
            hidePromotionModal();
            tryMove(move);
            promotionMove = null;
        });
    });
    
    // Handle game over
    function handleGameOver() {
        updateGameStatus();
        
        let outcomeText = '';
        let outcomeDescription = '';
        let sound = null;
        
        if (game.in_checkmate()) {
            if (game.turn() === 'w') {
                outcomeText = 'DEFEAT';
                outcomeDescription = 'The AI has checkmated you!';
                sound = defeatSound;
            } else {
                outcomeText = 'VICTORY';
                outcomeDescription = 'You have checkmated the AI!';
                sound = victorySound;
                
                // Show victory animation
                showVictoryAnimation();
            }
        } else if (game.in_draw()) {
            outcomeText = 'DRAW';
            
            if (game.in_stalemate()) {
                outcomeDescription = 'The game ended in stalemate.';
            } else if (game.in_threefold_repetition()) {
                outcomeDescription = 'Draw by threefold repetition.';
            } else if (game.insufficient_material()) {
                outcomeDescription = 'Draw by insufficient material.';
            } else {
                outcomeDescription = 'Draw by the 50-move rule.';
            }
        }
        
        gameOutcomeText.textContent = outcomeText;
        gameOutcomeDescription.textContent = outcomeDescription;
        
        // Play sound if available
        if (sound) {
            playSound(sound);
        }
        
        // Show game over modal after delay
        setTimeout(() => {
            gameOverModal.style.display = 'flex';
            setTimeout(() => {
                gameOverModal.style.opacity = '1';
            }, 10);
        }, 1500);
    }
    
    // Show victory animation
    function showVictoryAnimation() {
        const victoryAnimation = document.createElement('div');
        victoryAnimation.className = 'victory-animation';
        
        const victoryText = document.createElement('div');
        victoryText.className = 'victory-text';
        victoryText.textContent = 'VICTORY';
        
        victoryAnimation.appendChild(victoryText);
        document.body.appendChild(victoryAnimation);
        
        // Animate
        setTimeout(() => {
            victoryText.style.opacity = '1';
            victoryText.style.transform = 'scale(1)';
        }, 100);
        
        // Remove after animation
        setTimeout(() => {
            victoryAnimation.style.opacity = '0';
            setTimeout(() => {
                victoryAnimation.remove();
            }, 1000);
        }, 3000);
    }
    
    // Play a sound with current volume
    function playSound(soundElement) {
        if (settings.soundVolume > 0) {
            soundElement.currentTime = 0;
            soundElement.volume = settings.soundVolume / 100;
            soundElement.play().catch(e => console.log('Audio play error:', e));
        }
    }
    
    // Update audio volumes based on settings
    function updateAudioVolumes() {
        moveSound.volume = settings.soundVolume / 100;
        captureSound.volume = settings.soundVolume / 100;
        checkSound.volume = settings.soundVolume / 100;
        victorySound.volume = settings.soundVolume / 100;
        defeatSound.volume = settings.soundVolume / 100;
        backgroundMusic.volume = settings.musicVolume / 100;
    }
    
    // Start a new game
    function newGame() {
        game.reset();
        moveHistory = [];
        selectedSquare = null;
        aiThinking = false;
        promotionMove = null;
        
        updateBoard();
        updateMoveHistory();
        
        // Hide modals
        gameOverModal.style.opacity = '0';
        setTimeout(() => {
            gameOverModal.style.display = 'none';
        }, 300);
        
        promotionModal.style.opacity = '0';
        setTimeout(() => {
            promotionModal.style.display = 'none';
        }, 300);
        
        // Start background music if not already playing
        if (settings.musicVolume > 0 && backgroundMusic.paused) {
            backgroundMusic.play().catch(e => console.log('Music play error:', e));
        }
    }
    
    // Undo last move
    function undoMove() {
        if (aiThinking || moveHistory.length === 0) return;
        
        // Need to undo both player and AI moves
        const movesToUndo = game.turn() === 'w' ? 2 : 1;
        
        for (let i = 0; i < movesToUndo && moveHistory.length > 0; i++) {
            game.undo();
            moveHistory.pop();
        }
        
        updateBoard();
        updateMoveHistory();
    }
    
    // Show settings modal
    function showSettings() {
        soundVolume.value = settings.soundVolume;
        musicVolume.value = settings.musicVolume;
        animationSpeed.value = settings.animationSpeed;
        
        settingsModal.style.display = 'flex';
        setTimeout(() => {
            settingsModal.style.opacity = '1';
        }, 10);
    }
    
    // Hide settings modal
    function hideSettings() {
        settingsModal.style.opacity = '0';
        setTimeout(() => {
            settingsModal.style.display = 'none';
        }, 300);
    }
    
    // Save settings
    function saveSettings() {
        settings = {
            soundVolume: parseInt(soundVolume.value),
            musicVolume: parseInt(musicVolume.value),
            animationSpeed: parseInt(animationSpeed.value)
        };
        
        localStorage.setItem('blueBlazeChessSettings', JSON.stringify(settings));
        updateAudioVolumes();
        hideSettings();
    }
    
    // Event listeners
    newGameBtn.addEventListener('click', newGame);
    undoBtn.addEventListener('click', undoMove);
    settingsBtn.addEventListener('click', showSettings);
    
    playAgainBtn.addEventListener('click', () => {
        gameOverModal.style.opacity = '0';
        setTimeout(() => {
            gameOverModal.style.display = 'none';
            newGame();
        }, 300);
    });
    
    mainMenuBtn.addEventListener('click', () => {
        gameOverModal.style.opacity = '0';
        setTimeout(() => {
            gameOverModal.style.display = 'none';
        }, 300);
    });
    
    saveSettingsBtn.addEventListener('click', saveSettings);
    cancelSettingsBtn.addEventListener('click', hideSettings);
    
    // Initialize the game
    initBoard();
    newGame();
});
