/**
 * Spotify Web Playback SDK 관련 코드 제거됨
 * 검색 기능만 사용하므로 플레이어 초기화 불필요
 */

// Gemini API 키는 서버에서 관리됩니다 (보안상 클라이언트에 노출하지 않음)
// Gemini 모델 ID: gemini-2.5-flash 사용 (최신 모델)
const GEMINI_MODEL_ID = "gemini-2.5-flash";
let activeWordTooltip = null;

// 브라우저의 스크롤 복원 동작 비활성화
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

// ============================================
// Socket.io 실시간 채팅 (전역 변수)
// ============================================
let socket = null;
let currentRoomId = null;
let currentUsername = 'User'; // 사용자 이름 (나중에 로그인 시스템과 연동)

// ============================================
// Socket.io 실시간 채팅 함수들
// ============================================

// 방 입장 시 Socket.io 연결 초기화
function initializeChatSocket(roomId, username) {
    // 기존 연결이 있으면 닫기
    if (socket) {
        socket.disconnect();
    }
    
    // Socket.io 연결
    socket = io('http://127.0.0.1:11304', {
        transports: ['websocket', 'polling']
    });
    
    currentRoomId = roomId;
    currentUsername = username || 'User';
    
    // 연결 성공
    socket.on('connect', () => {
        console.log('✅ 채팅 서버에 연결되었습니다.');
        
        // 방 입장
        socket.emit('join-room', roomId, currentUsername);
    });
    
    // 새 메시지 수신
    socket.on('new-message', (data) => {
        addMessageToChat(data.username, data.message, data.timestamp, data.socketId === socket.id);
    });
    
    // 사용자 입장 알림
    socket.on('user-joined', (data) => {
        // 참여자 수 업데이트
        const chatRoomMeta = document.getElementById('chat-room-meta');
        if (chatRoomMeta) {
            chatRoomMeta.textContent = `실시간 참여 인원 · ${data.roomSize}명`;
        }
        
        // 시스템 메시지 표시 (선택사항)
        addSystemMessage(data.message);
    });
    
    // 사용자 퇴장 알림
    socket.on('user-left', (data) => {
        const chatRoomMeta = document.getElementById('chat-room-meta');
        if (chatRoomMeta) {
            chatRoomMeta.textContent = `실시간 참여 인원 · ${data.roomSize}명`;
        }
        addSystemMessage(data.message);
    });
    
    // 연결 오류
    socket.on('connect_error', (error) => {
        console.error('❌ 채팅 서버 연결 오류:', error);
        alert('채팅 서버에 연결할 수 없습니다. 페이지를 새로고침해주세요.');
    });
}

// 메시지를 채팅에 추가하는 함수
function addMessageToChat(username, message, timestamp, isOwnMessage) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const now = timestamp ? new Date(timestamp) : new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = isOwnMessage ? 'message user' : 'message user-alt';
    messageDiv.setAttribute('data-timestamp', now.getTime());
    messageDiv.innerHTML = `
        <div class="user-meta">${escapeHtml(username)} · ${timeString}</div>
        <div class="bubble">${escapeHtml(message)}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    
    // 새로 추가된 메시지의 단어를 감싸기 (기존 기능 유지)
    const newBubble = messageDiv.querySelector('.bubble');
    if (newBubble && window.wrapWordsInBubble) {
        window.wrapWordsInBubble(newBubble);
    }
    
    // 스크롤을 맨 아래로
    requestAnimationFrame(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 10);
    });
}

// 시스템 메시지 추가
function addSystemMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.innerHTML = `
        <div class="bubble" style="font-size: 0.9rem; color: #666;">${escapeHtml(message)}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    const button = document.getElementById('interactive-btn');
    const message = document.getElementById('message');
    const viewer = document.getElementById('original-text-viewer');
    const vocabButton = document.getElementById('generate-vocab-btn');
    const levelButtons = document.querySelectorAll('.level-toggle .level-btn');
    const toolsTabButtons = document.querySelectorAll('.tools-tabs .tools-tab-btn');
    const toolsContent = document.querySelector('#learning-tools .tools-content');
    const joinButtons = document.querySelectorAll('.join-btn');
    const communityPage = document.getElementById('community-page');
    const communityRoomPage = document.getElementById('community-room-page');
    const chatBackButton = document.querySelector('.chat-back-btn');
    const chatRoomTitle = document.getElementById('chat-room-title');
    const chatRoomMeta = document.getElementById('chat-room-meta');
    const chatInput = document.getElementById('chat-input');
    const chatCorrectionBtn = document.getElementById('ai-correction-btn');
    const chatCorrectionPreview = document.getElementById('ai-correction-preview');
    
    // 버튼 클릭 이벤트 리스너
    if (button && message) {
        button.addEventListener('click', function() {
            // 메시지 표시
            message.textContent = 'LitConnect 프로젝트가 성공적으로 작동하고 있습니다! 🎉';
            message.classList.add('show');
            
            // 버튼 애니메이션 효과
            button.style.transform = 'scale(0.95)';
            setTimeout(() => {
                button.style.transform = 'scale(1)';
            }, 150);
            
            // 3초 후 메시지 숨기기
            setTimeout(() => {
                message.classList.remove('show');
            }, 3000);
        });
    }
    
    if (viewer) {
        prepareViewerWords(viewer);

        viewer.addEventListener('click', function(event) {
            const target = event.target;
            
            // 단어 클릭 처리 (기존 로직)
            if (target.classList.contains('viewer-word')) {
                const rawText = target.textContent || '';
                const cleanedWord = rawText
                    .replace(/[\s,.?!:;"'()\[\]{}]/g, '')
                    .trim()
                    .toLowerCase();

                if (cleanedWord) {
                    showWordTooltip(target, cleanedWord);
                    getWordDefinitionFromAI(cleanedWord);
                }
                return; // 단어 클릭 시 번역 처리하지 않음
            }
            
            // 문장/단락 클릭 처리 (번역 기능)
            if (target.classList.contains('viewer-text')) {
                const textToTranslate = target.textContent.trim();
                if (textToTranslate) {
                    handleTextTranslation(textToTranslate, target);
                }
            }
        });

        viewer.addEventListener('mouseleave', () => {
            hideWordTooltip();
        });

        viewer.addEventListener('scroll', () => {
            hideWordTooltip();
        });
    }

    if (viewer && levelButtons.length) {
        levelButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                if (btn.classList.contains('active')) {
                    return;
                }

                const selectedLevel = btn.dataset.level;
                showViewerLevel(selectedLevel, viewer, levelButtons);
                currentViewerLevel = selectedLevel;
                
                // 레벨 변경 시 목차 업데이트
                if (currentBookTitle) {
                    await updateTableOfContents(currentBookTitle, cachedTotalChapters, selectedLevel);
                    
                    // 해당 레벨의 첫 번째 챕터 로드
                    const totalChapters = cachedTotalChapters || 61;
                    const chapterRange = getChaptersForLevel(selectedLevel, totalChapters);
                    
                    if (typeof loadChapter === 'function') {
                        try {
                            await loadChapter(currentBookTitle, chapterRange.start);
                            currentViewerChapter = chapterRange.start;
                            
                            const viewerElement = document.getElementById('original-text-viewer');
                            if (viewerElement) {
                                viewerElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        } catch (error) {
                            console.error('❌ 챕터 로드 오류:', error);
                        }
                    }
                }
            });
        });
    }

    // 목차 챕터 링크 클릭 이벤트는 updateTableOfContents 함수에서 동적으로 추가됩니다.
    // 초기 목차가 있을 경우를 위한 이벤트 위임 (이벤트 버블링 활용)
    const tocList = document.querySelector('.toc-list');
    if (tocList) {
        tocList.addEventListener('click', async function(e) {
            const link = e.target.closest('a');
            if (!link) return;
            
            e.preventDefault();
            const href = link.getAttribute('href');
            const chapterMatch = href.match(/#chapter-(\d+)/);
            if (chapterMatch) {
                const chapterNumber = parseInt(chapterMatch[1]);
                
                if (!currentBookTitle) {
                    console.warn('⚠️ 책이 선택되지 않았습니다. 먼저 책을 선택해주세요.');
                    alert('책을 먼저 선택해주세요.');
                    return;
                }
                
                console.log(`📖 목차에서 챕터 ${chapterNumber} 선택: ${currentBookTitle}`);
                
                if (typeof loadChapter === 'function') {
                    try {
                        await loadChapter(currentBookTitle, chapterNumber);
                        currentViewerChapter = chapterNumber;
                        
                        const viewerElement = document.getElementById('original-text-viewer');
                        if (viewerElement) {
                            viewerElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    } catch (error) {
                        console.error('❌ 챕터 로드 오류:', error);
                        alert(`챕터를 불러오는 중 오류가 발생했습니다: ${error.message}`);
                    }
                } else {
                    console.error('❌ loadChapter 함수를 찾을 수 없습니다.');
                }
            }
        });
    }

    // AI 뷰어 페이지가 표시될 때 초기 챕터 로드
    const aiViewerPage = document.getElementById('ai-viewer-page');
    if (aiViewerPage && viewer) {
        // 페이지 표시 감지를 위한 MutationObserver
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const isVisible = aiViewerPage.style.display !== 'none';
                    if (isVisible) {
                        // 초기 챕터 로드 (Chapter 1, Beginner 레벨)
                        const activeLevelBtn = document.querySelector('.level-toggle .level-btn.active');
                        const currentLevel = activeLevelBtn ? activeLevelBtn.dataset.level : 'beginner';
                        loadChapterForViewer(1, currentLevel);
                    }
                }
            });
        });
        
        observer.observe(aiViewerPage, {
            attributes: true,
            attributeFilter: ['style']
        });
    }

    if (vocabButton && viewer) {
        vocabButton.addEventListener('click', () => {
            // 저장된 단어장 표시
            loadSavedVocabulary();
        });
    }

    // 줄거리 요약 버튼 클릭 이벤트
    const summaryButton = document.getElementById('summary-button');
    if (summaryButton) {
        summaryButton.addEventListener('click', async () => {
            await fetchSummary();
        });
    }

    // 토론 주제 생성 버튼 클릭 이벤트
    const generateTopicsBtn = document.getElementById('generate-topics-btn');
    if (generateTopicsBtn) {
        generateTopicsBtn.addEventListener('click', async () => {
            await handleDiscussionTopics();
        });
    }

    if (toolsContent && toolsTabButtons.length) {
        toolsTabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.classList.contains('active')) {
                    return;
                }
                showToolsTab(btn.dataset.tab, toolsContent, toolsTabButtons);
                
                // 단어장 탭이 활성화되면 단어장 표시
                if (btn.dataset.tab === 'vocab') {
                    loadSavedVocabulary();
                }
            });
        });
        
        // 초기 로드 시 단어장 탭이 활성화되어 있으면 단어장 표시
        const activeVocabTab = document.querySelector('.tools-tab-btn[data-tab="vocab"].active');
        if (activeVocabTab) {
            loadSavedVocabulary();
        }
    }

    // 저장된 커뮤니티 로드
    function loadUserCommunities() {
        const communities = JSON.parse(localStorage.getItem('userCommunities') || '[]');
        const communityGrid = document.querySelector('.community-grid');
        
        if (!communityGrid || communities.length === 0) return;
        
        communities.forEach(community => {
            // 이미 존재하는지 확인
            const existingRoom = communityGrid.querySelector(`[data-room-id="${community.id}"]`);
            if (existingRoom) return;
            
            const level = community.level || 'beginner';
            const levelText = level === 'beginner' ? 'Beginner' : level === 'intermediate' ? 'Intermediate' : 'Advanced';
            
            const newRoom = document.createElement('article');
            newRoom.className = 'discussion-room';
            newRoom.setAttribute('data-category', community.category);
            newRoom.setAttribute('data-level', level);
            newRoom.setAttribute('data-room-id', community.id);
            if (community.book) {
                newRoom.setAttribute('data-book', community.book);
            }
            
            newRoom.innerHTML = `
                <button class="delete-community-btn" data-room-id="${community.id}" aria-label="커뮤니티 삭제" title="커뮤니티 삭제">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <div class="room-level-bar">
                    <span class="room-level-text">${levelText}</span>
                </div>
                <div class="room-topic">
                    <h4>${escapeHtml(community.title)}</h4>
                    ${community.book ? `<div class="room-book-title">${escapeHtml(community.book)}</div>` : ''}
                    <p>${escapeHtml(community.insight || '새로운 토론 주제입니다.')}</p>
                </div>
                <div class="room-meta">
                    <button class="btn join-btn" data-room="${community.id}" data-level="${level}">참여하기</button>
                    <span class="room-participants">${community.currentParticipants || 1} / ${Math.min(6, community.maxParticipants || 6)}</span>
                </div>
            `;
            
            // 커뮤니티 목록 맨 앞에 추가
            communityGrid.insertBefore(newRoom, communityGrid.firstChild);
        });
        
        // 필터링 다시 적용
        filterDiscussionRooms();
    }
    
    // 토론 커뮤니티 필터 기능
    const filterPills = document.querySelectorAll('.filter-pill');
    let discussionRooms = document.querySelectorAll('.discussion-room');
    
    // 필터링 함수 (카테고리 + 레벨)
    function filterDiscussionRooms() {
        discussionRooms = document.querySelectorAll('.discussion-room');
        
        // 활성화된 카테고리 필터 찾기
        const activeCategoryFilter = document.querySelector('.filter-pill[data-filter-type="category"].active');
        const categoryFilterValue = activeCategoryFilter ? (activeCategoryFilter.dataset.filter || 'all') : 'all';
        
        // 활성화된 레벨 필터 찾기
        const activeLevelFilter = document.querySelector('.filter-pill[data-filter-type="level"].active');
        const levelFilterValue = activeLevelFilter ? (activeLevelFilter.dataset.filter || 'all') : 'all';
        
        discussionRooms.forEach(room => {
            const roomCategory = room.dataset.category || '';
            const roomLevel = room.dataset.level || '';
            
            // 카테고리 필터 체크
            let categoryMatch = false;
            if (categoryFilterValue === 'all') {
                categoryMatch = true;
            } else {
                categoryMatch = roomCategory === categoryFilterValue;
            }
            
            // 레벨 필터 체크
            let levelMatch = false;
            if (levelFilterValue === 'all') {
                levelMatch = true;
            } else {
                levelMatch = roomLevel === levelFilterValue;
            }
            
            // 두 필터 모두 일치해야 표시
            if (categoryMatch && levelMatch) {
                room.style.display = '';
            } else {
                room.style.display = 'none';
            }
        });
    }
    
    // 페이지 로드 시 저장된 커뮤니티 불러오기
    loadUserCommunities();
    
    // 활성 필터 업데이트 함수
    function updateActiveFilters() {
        const activeCategoryFilter = document.querySelector('.filter-pill[data-filter-type="category"].active');
        const activeLevelFilter = document.querySelector('.filter-pill[data-filter-type="level"].active');
        
        const activeCategoryValue = document.getElementById('active-category-filter');
        const activeLevelValue = document.getElementById('active-level-filter');
        
        if (activeCategoryValue && activeCategoryFilter) {
            activeCategoryValue.textContent = activeCategoryFilter.textContent.trim();
        }
        
        if (activeLevelValue && activeLevelFilter) {
            activeLevelValue.textContent = activeLevelFilter.textContent.trim();
        }
    }
    
    if (filterPills.length > 0) {
        filterPills.forEach(pill => {
            pill.addEventListener('click', () => {
                const filterType = pill.dataset.filterType; // 'category' or 'level'
                
                // 같은 타입의 필터에서만 active 클래스 제거
                document.querySelectorAll(`.filter-pill[data-filter-type="${filterType}"]`).forEach(p => {
                    p.classList.remove('active');
                });
                
                // 클릭한 필터에 active 클래스 추가
                pill.classList.add('active');
                filterDiscussionRooms();
                updateActiveFilters();
            });
        });
    }
    
    // 페이지 로드 시 초기 활성 필터 표시
    updateActiveFilters();
    
    // 커뮤니티 생성 기능
    const createCommunityBtn = document.getElementById('create-community-btn');
    const createCommunityModal = document.getElementById('create-community-modal');
    const createCommunityModalClose = document.getElementById('create-community-modal-close');
    const createCommunityCancelBtn = document.getElementById('create-community-cancel-btn');
    const createCommunitySubmitBtn = document.getElementById('create-community-submit-btn');
    const newCommunityTitleInput = document.getElementById('new-community-title');
    const newCommunityInsightInput = document.getElementById('new-community-insight');
    const newCommunityCategorySelect = document.getElementById('new-community-category');
    const newCommunityLevelSelect = document.getElementById('new-community-level');
    const newCommunityBookSelect = document.getElementById('new-community-book');
    const newCommunityMaxParticipantsInput = document.getElementById('new-community-max-participants');
    
    // 읽은 책 목록 가져오기 함수는 전역 스코프에 정의되어 있음 (getReadBooks)
    
    // 책 선택 드롭다운 로드 함수
    function loadBookSelect() {
        if (!newCommunityBookSelect) return;
        
        const readBooks = getReadBooks();
        
        // 기존 옵션 제거 (첫 번째 "책을 선택하세요" 옵션 제외)
        while (newCommunityBookSelect.options.length > 1) {
            newCommunityBookSelect.remove(1);
        }
        
        // 책 목록 추가
        readBooks.forEach(book => {
            const option = document.createElement('option');
            option.value = book.title;
            option.textContent = `${book.title} - ${book.author || ''}`;
            newCommunityBookSelect.appendChild(option);
        });
    }
    
    // 책 선택 검증 함수
    function validateBookSelection() {
        if (!newCommunityBookSelect) return true;
        const selectedBook = newCommunityBookSelect.value.trim();
        if (!selectedBook) {
            return false;
        }
        return true;
    }
    
    // 새 커뮤니티 만들기 버튼 클릭
    if (createCommunityBtn && createCommunityModal) {
        createCommunityBtn.addEventListener('click', function() {
            createCommunityModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            if (newCommunityTitleInput) newCommunityTitleInput.value = '';
            if (newCommunityInsightInput) newCommunityInsightInput.value = '';
            if (newCommunityCategorySelect) newCommunityCategorySelect.value = '문학 해석';
            if (newCommunityMaxParticipantsInput) newCommunityMaxParticipantsInput.value = '6';
            if (newCommunityBookSelect) newCommunityBookSelect.value = '';
            // 책 목록 로드
            loadBookSelect();
        });
    }
    
    // 커뮤니티 생성 모달 닫기
    function closeCreateCommunityModal() {
        if (createCommunityModal) {
            createCommunityModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
    
    if (createCommunityModalClose) {
        createCommunityModalClose.addEventListener('click', closeCreateCommunityModal);
    }
    
    if (createCommunityCancelBtn) {
        createCommunityCancelBtn.addEventListener('click', closeCreateCommunityModal);
    }
    
    // 커뮤니티 생성 제출
    if (createCommunitySubmitBtn && newCommunityTitleInput) {
        createCommunitySubmitBtn.addEventListener('click', function() {
            const title = newCommunityTitleInput.value.trim();
            const insight = newCommunityInsightInput.value.trim();
            const category = newCommunityCategorySelect ? newCommunityCategorySelect.value : '문학 해석';
            const level = newCommunityLevelSelect ? newCommunityLevelSelect.value : 'beginner';
            const selectedBook = newCommunityBookSelect ? newCommunityBookSelect.value.trim() : '';
            const maxParticipants = newCommunityMaxParticipantsInput ? Math.min(6, Math.max(2, parseInt(newCommunityMaxParticipantsInput.value) || 6)) : 6;
            
            if (!title) {
                return;
            }
            
            // 책 선택 검증
            if (!validateBookSelection()) {
                return;
            }
            
            // 레벨 표시 텍스트
            const levelText = level === 'beginner' ? 'Beginner' : level === 'intermediate' ? 'Intermediate' : 'Advanced';
            
            // 커뮤니티 생성
            const communityGrid = document.querySelector('.community-grid');
            if (communityGrid) {
                const roomId = 'room-' + Date.now();
                const newRoom = document.createElement('article');
                newRoom.className = 'discussion-room';
                newRoom.setAttribute('data-category', category);
                newRoom.setAttribute('data-level', level);
                if (selectedBook) {
                    newRoom.setAttribute('data-book', selectedBook);
                }
                newRoom.innerHTML = `
                    <button class="delete-community-btn" data-room-id="${roomId}" aria-label="커뮤니티 삭제" title="커뮤니티 삭제">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                    <div class="room-level-bar">
                        <span class="room-level-text">${levelText}</span>
                    </div>
                    <div class="room-topic">
                        <h4>${escapeHtml(title)}</h4>
                        ${selectedBook ? `<div class="room-book-title">${escapeHtml(selectedBook)}</div>` : ''}
                        <p>${escapeHtml(insight || '새로운 토론 주제입니다.')}</p>
                    </div>
                    <div class="room-meta">
                        <button class="btn join-btn" data-room="${roomId}" data-level="${level}">참여하기</button>
                        <span class="room-participants">1 / ${Math.min(6, maxParticipants)}</span>
                    </div>
                `;
                
                // 커뮤니티 목록 맨 앞에 추가
                communityGrid.insertBefore(newRoom, communityGrid.firstChild);
                newRoom.setAttribute('data-room-id', roomId);
                
                // 커뮤니티 정보를 localStorage에 저장
                const communities = JSON.parse(localStorage.getItem('userCommunities') || '[]');
                communities.unshift({
                    id: roomId,
                    title: title,
                    insight: insight,
                    category: category,
                    level: level,
                    book: selectedBook,
                    maxParticipants: Math.min(6, maxParticipants),
                    currentParticipants: 1,
                    createdAt: Date.now()
                });
                localStorage.setItem('userCommunities', JSON.stringify(communities));
                
                // getCommunityRoomInfo에 추가
                if (!window.getCommunityRoomInfo) {
                    window.getCommunityRoomInfo = getCommunityRoomInfo;
                }
                
                // 필터링 다시 적용
                filterDiscussionRooms();
            }
            
            // 모달 닫기
            closeCreateCommunityModal();
        });
    }

    // 원문 참조 패널 확장/축소 기능
    const referencePanel = document.getElementById('reference-panel');
    const referenceExpandBtn = document.getElementById('reference-expand-btn');
    const referenceCollapseBtn = document.getElementById('reference-collapse-btn');
    const referencePanelContent = document.getElementById('reference-panel-content');
    const referencePanelExpanded = document.getElementById('reference-panel-expanded');
    const referenceLevelButtons = document.querySelectorAll('.reference-level-btn');
    
    if (referenceExpandBtn && referencePanel) {
        referenceExpandBtn.addEventListener('click', function() {
            referencePanel.classList.add('expanded');
            if (referencePanelContent) referencePanelContent.style.display = 'none';
            if (referencePanelExpanded) referencePanelExpanded.style.display = 'flex';
        });
    }
    
    if (referenceCollapseBtn && referencePanel) {
        referenceCollapseBtn.addEventListener('click', function() {
            referencePanel.classList.remove('expanded');
            if (referencePanelContent) referencePanelContent.style.display = 'block';
            if (referencePanelExpanded) referencePanelExpanded.style.display = 'none';
        });
    }
    
    // 원문 레벨 전환 기능 비활성화 (해당 레벨만 표시하도록 변경됨)
    // 레벨 전환 버튼은 loadOriginalTextForRoom에서 숨겨짐

    // 참여하기 버튼 이벤트 (이벤트 위임 사용)
    if (communityPage && communityRoomPage) {
        document.addEventListener('click', function(e) {
            const joinBtn = e.target.closest('.join-btn');
            if (joinBtn) {
                const roomId = joinBtn.dataset.room || 'room-gatsby-dream';
                const roomLevel = joinBtn.dataset.level || 'beginner';
                
                // 사용자 이름 가져오기 (localStorage 또는 입력받기)
                const username = localStorage.getItem('username') || prompt('이름을 입력하세요:') || 'User';
                localStorage.setItem('username', username);
                currentUsername = username;
                
                // Socket.io 연결 초기화
                initializeChatSocket(roomId, username);
                
                // localStorage에서 커뮤니티 정보 찾기
                const communities = JSON.parse(localStorage.getItem('userCommunities') || '[]');
                const userCommunity = communities.find(c => c.id === roomId);
                
                if (userCommunity) {
                    chatRoomTitle.textContent = userCommunity.title;
                    chatRoomMeta.textContent = `실시간 참여 인원 · ${userCommunity.currentParticipants || 1}명`;
                    // 원문 참조 패널에 레벨에 맞는 원서 표시
                    loadOriginalTextForRoom(roomId, userCommunity.level || roomLevel);
                } else {
                    // 기본 커뮤니티 정보 사용
                    const roomInfo = getCommunityRoomInfo(roomId);
                    chatRoomTitle.textContent = roomInfo.title;
                    chatRoomMeta.textContent = roomInfo.meta;
                    // 원문 참조 패널에 레벨에 맞는 원서 표시
                    loadOriginalTextForRoom(roomId, roomLevel);
                }
                
                showPage('community-room-page');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }
    
    // 커뮤니티 삭제 기능
    document.addEventListener('click', function(e) {
        const deleteBtn = e.target.closest('.delete-community-btn');
        if (deleteBtn) {
            e.stopPropagation();
            const roomId = deleteBtn.getAttribute('data-room-id');
            
            if (!roomId) return;
            
            if (confirm('정말 이 커뮤니티를 삭제하시겠습니까?')) {
                // localStorage에서 커뮤니티 제거
                const communities = JSON.parse(localStorage.getItem('userCommunities') || '[]');
                const filteredCommunities = communities.filter(c => c.id !== roomId);
                localStorage.setItem('userCommunities', JSON.stringify(filteredCommunities));
                
                // DOM에서 커뮤니티 카드 제거
                const communityCard = document.querySelector(`[data-room-id="${roomId}"]`);
                if (communityCard) {
                    communityCard.remove();
                }
                
                // 필터링 다시 적용
                filterDiscussionRooms();
            }
        }
    });
    
    // 채팅 메시지에서 단어 툴팁 기능
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        // 단일 버블의 단어를 감싸는 함수 (전역에서 사용 가능하도록)
        window.wrapWordsInBubble = function(bubble) {
            // 이미 감싸져 있으면 스킵
            if (bubble.querySelector('.word-hoverable')) {
                return;
            }
            
            const text = bubble.textContent || '';
            const words = text.split(/(\s+|[.,!?;:])/);
            const wrappedHTML = words.map(word => {
                // 영어 단어만 감싸기 (3글자 이상)
                if (word.match(/^[A-Za-z]{3,}$/)) {
                    return `<span class="word-hoverable" data-word="${word.toLowerCase()}">${word}</span>`;
                }
                return word;
            }).join('');
            
            bubble.innerHTML = wrappedHTML;
        };
        
        // 채팅 메시지의 단어를 감싸는 함수
        function wrapWordsInBubbles() {
            const bubbles = chatMessages.querySelectorAll('.bubble');
            bubbles.forEach(bubble => {
                window.wrapWordsInBubble(bubble);
            });
        }
        
        // 초기 메시지 감싸기
        wrapWordsInBubbles();
        
        // 새 메시지가 추가될 때마다 감싸기 (MutationObserver 사용)
        // innerHTML 변경으로 인한 무한 루프 방지를 위해 실제 메시지 노드만 처리
        const observer = new MutationObserver(function(mutations) {
            let hasNewMessage = false;
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(function(node) {
                        // 실제 메시지 div가 추가된 경우만 처리 (innerHTML 변경은 무시)
                        if (node.nodeType === 1 && node.classList && node.classList.contains('message')) {
                            hasNewMessage = true;
                        }
                    });
                }
            });
            
            // 실제 새 메시지가 추가된 경우에만 처리
            if (hasNewMessage) {
                // observer를 일시적으로 비활성화하여 무한 루프 방지
                observer.disconnect();
                wrapWordsInBubbles();
                // 약간의 지연 후 다시 연결
                setTimeout(() => {
                    observer.observe(chatMessages, {
                        childList: true,
                        subtree: true
                    });
                }, 50);
            }
        });
        
        observer.observe(chatMessages, {
            childList: true,
            subtree: true
        });
        
        // 단어 클릭 시 툴팁 표시
        chatMessages.addEventListener('click', function(e) {
            const wordSpan = e.target.closest('.word-hoverable');
            if (wordSpan) {
                e.preventDefault();
                e.stopPropagation();
                const word = wordSpan.dataset.word;
                if (word && word.length >= 3) {
                    // 기존 툴팁이 있으면 제거
                    hideWordTooltip();
                    // 새 툴팁 표시
                    showWordTooltipForChat(wordSpan, word);
                    getWordDefinitionForChat(word);
                }
            } else {
                // 단어가 아닌 곳을 클릭하면 툴팁 숨기기
                hideWordTooltip();
            }
        });
        
        // 스크롤 시 툴팁 숨기기
        chatMessages.addEventListener('scroll', function() {
            hideWordTooltip();
        });
        
        // 외부 클릭 시 툴팁 숨기기
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.word-hoverable') && !e.target.closest('.word-tooltip')) {
                hideWordTooltip();
            }
        });
    }
    
    // 채팅용 단어 툴팁 표시 함수
    function showWordTooltipForChat(targetElement, word) {
        const tooltipData = getDummyTooltipData(word);
        if (!tooltipData) {
            // 임시 툴팁 표시
            if (!activeWordTooltip) {
                activeWordTooltip = document.createElement('div');
                activeWordTooltip.className = 'word-tooltip';
                document.body.appendChild(activeWordTooltip);
            }
            
            activeWordTooltip.innerHTML = `
                <h5>${escapeHtml(word)}</h5>
                <p>AI가 단어 정보를 찾는 중...</p>
            `;
        } else {
            if (!activeWordTooltip) {
                activeWordTooltip = document.createElement('div');
                activeWordTooltip.className = 'word-tooltip';
                document.body.appendChild(activeWordTooltip);
            }
            
            activeWordTooltip.innerHTML = `
                <h5>${escapeHtml(tooltipData.word)}</h5>
                <p><strong>Pronunciation</strong>: ${escapeHtml(tooltipData.pronunciation)}</p>
                <p><strong>Meaning</strong>: ${escapeHtml(tooltipData.meaning)}</p>
                <p><strong>Example</strong>: ${escapeHtml(tooltipData.example)}</p>
                <small>AI 정보 로딩 중...</small>
            `;
        }
        
        const rect = targetElement.getBoundingClientRect();
        const tooltipRect = activeWordTooltip.getBoundingClientRect();
        const top = window.scrollY + rect.top - tooltipRect.height - 12;
        const left = window.scrollX + rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        
        activeWordTooltip.style.top = `${Math.max(12, top)}px`;
        activeWordTooltip.style.left = `${Math.max(12, Math.min(left, window.innerWidth - tooltipRect.width - 12))}px`;
        
        requestAnimationFrame(() => {
            activeWordTooltip.classList.add('visible');
        });
    }
    
    // 채팅용 단어 정의 가져오기 함수
    let chatWordTooltipCache = {};
    
    async function getWordDefinitionForChat(word) {
        // 캐시 확인
        if (chatWordTooltipCache[word]) {
            updateChatTooltip(word, chatWordTooltipCache[word]);
            return;
        }
        
        try {
            const model = createGeminiModel();
            if (!model) {
                return;
            }
            
            const prompt = `당신은 영어 독서 학습 도우미입니다. 사용자에게 **${word}**에 대한 정보를 요청받았습니다.
아래 형식에 맞게 해당 단어의 뜻, 발음, 그리고 예문 하나를 한국어로 친절하게 설명해주세요.

**단어**: ${word}
**발음**: [발음을 국제음성기호(IPA)나 쉬운 표기로]
**뜻**: [간결하고 정확한 한국어 뜻]
**예문**: [단어가 포함된 영어 예문 및 그 한국어 번역]`;
            
            // generateContent 호출 (안전한 형식 사용)
            let result;
            try {
                // 먼저 문자열 직접 전달 시도
                result = await model.generateContent(prompt);
            } catch (stringError) {
                // 객체 형식으로 재시도
                result = await model.generateContent({
                    contents: [{
                        role: 'user',
                        parts: [{ text: prompt }],
                    }],
                });
            }
            
            if (!result || !result.response || typeof result.response.text !== 'function') {
                return;
            }
            
            const text = result.response.text();
            const tooltipData = parseWordDefinition(text, word);
            
            // 캐시에 저장
            chatWordTooltipCache[word] = tooltipData;
            
            // 툴팁 업데이트
            updateChatTooltip(word, tooltipData);
        } catch (error) {
            console.error('채팅 단어 정의 가져오기 오류:', error);
        }
    }
    
    // 단어 정의 파싱 함수
    function parseWordDefinition(text, word) {
        const pronunciationMatch = text.match(/발음[:\s]*\[?([^\]]+)\]?/i);
        const meaningMatch = text.match(/뜻[:\s]*([^\n]+)/i);
        const exampleMatch = text.match(/예문[:\s]*([^\n]+)/i);
        
        return {
            word: word,
            pronunciation: pronunciationMatch ? pronunciationMatch[1].trim() : '[발음 정보 없음]',
            meaning: meaningMatch ? meaningMatch[1].trim() : '의미 정보를 가져오는 중...',
            example: exampleMatch ? exampleMatch[1].trim() : '예문 정보를 가져오는 중...'
        };
    }
    
    // 채팅 툴팁 업데이트 함수
    function updateChatTooltip(word, tooltipData) {
        if (!activeWordTooltip || !activeWordTooltip.classList.contains('visible')) {
            return;
        }
        
        activeWordTooltip.innerHTML = `
            <h5>${escapeHtml(tooltipData.word)}</h5>
            <p><strong>Pronunciation</strong>: ${escapeHtml(tooltipData.pronunciation)}</p>
            <p><strong>Meaning</strong>: ${escapeHtml(tooltipData.meaning)}</p>
            <p><strong>Example</strong>: ${escapeHtml(tooltipData.example)}</p>
            <small>LitConnect 사전</small>
        `;
    }

    // Back 버튼 클릭 시 Socket 연결 해제
    document.querySelector('.chat-back-btn')?.addEventListener('click', () => {
        if (socket) {
            socket.disconnect();
            socket = null;
            currentRoomId = null;
        }
        showPage('community-page');
    });
    
    // 채팅 메시지 전송 함수 (Socket.io 사용)
    window.sendChatMessage = function() {
        const chatInput = document.getElementById('chat-input');
        if (!chatInput) return false;
        
        const text = chatInput.value.trim();
        if (!text) return false;
        
        // Socket.io를 통해 메시지 전송
        if (socket && socket.connected && currentRoomId) {
            socket.emit('chat-message', {
                roomId: currentRoomId,
                message: text,
                username: currentUsername,
                timestamp: Date.now()
            });
            
            // 입력 필드 초기화
            chatInput.value = '';
            chatInput.focus();
            
            // AI 교정 미리보기 숨기기
            const chatCorrectionPreview = document.getElementById('ai-correction-preview');
            if (chatCorrectionPreview) {
                chatCorrectionPreview.classList.remove('visible');
            }
            
            return true;
        } else {
            alert('채팅 서버에 연결되지 않았습니다. 페이지를 새로고침해주세요.');
            return false;
        }
    };
    
    // 전송 버튼 클릭 이벤트 (type="button"으로 변경했으므로 클릭 이벤트만 처리)
    document.addEventListener('click', function(e) {
        const target = e.target;
        if (target && (target.classList.contains('send-btn') || target.closest('.send-btn'))) {
            const sendBtn = target.classList.contains('send-btn') ? target : target.closest('.send-btn');
            const form = sendBtn.closest('form');
            if (form && (form.id === 'chat-input-form' || form.classList.contains('chat-input-area'))) {
                e.preventDefault();
                e.stopPropagation();
                window.sendChatMessage();
            }
        }
    }, true);
    
    // Form submit 이벤트도 처리 (Enter 키 등으로 인한 submit 방지)
    document.addEventListener('submit', function(e) {
        const form = e.target;
        if (form && (form.id === 'chat-input-form' || form.classList.contains('chat-input-area'))) {
            e.preventDefault();
            e.stopPropagation();
            window.sendChatMessage();
        }
    }, true);
    
    // Enter 키 이벤트 (전역 처리)
    document.addEventListener('keydown', function(e) {
        const chatInput = document.getElementById('chat-input');
        if (chatInput && document.activeElement === chatInput) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                window.sendChatMessage();
            }
        }
    }, true);

    if (chatCorrectionBtn && chatInput && chatCorrectionPreview) {
        // 교정 언어 선택 드롭다운 요소 가져오기
        const correctionLangSelect = document.getElementById('correction-lang-select');
        
        chatCorrectionBtn.addEventListener('click', async () => {
            // 사용자가 입력창에 작성한 영어 텍스트 가져오기
            const text = chatInput.value.trim();
            
            if (!text) {
                chatCorrectionPreview.classList.add('visible');
                chatCorrectionPreview.innerHTML = `
                    <h5>AI Correction Preview</h5>
                    <p class="placeholder">교정을 요청하려면 먼저 메시지를 입력해주세요.</p>
                `;
                return;
            }

            // 드롭다운에서 선택된 언어 값 가져오기 (기본값: 'EN')
            const targetLang = correctionLangSelect ? correctionLangSelect.value : 'EN';

            // 로딩 상태 표시
            chatCorrectionPreview.classList.add('visible');
            chatCorrectionPreview.innerHTML = `
                <h5>AI Correction Preview</h5>
                <p class="placeholder">AI가 교정 중...</p>
            `;

            try {
                // requestAiCorrection() 함수 호출 (targetLang 인수 전달)
                const correction = await requestAiCorrection(text, targetLang);
                
                // 서버로부터 교정된 텍스트를 받으면 '교정된 문장' 영역에 표시
                // 번역 결과와 별개로 교정 결과만 업데이트
                const existingHTML = chatCorrectionPreview.innerHTML;
                
                // 기존 번역 결과가 있는지 확인
                const translationMatch = existingHTML.match(/<p><strong>영어 번역<\/strong>:.*?<\/p>/);
                const translationHTML = translationMatch ? translationMatch[0] : '';
                
                // 교정된 문장 영역 업데이트 (번역 결과는 유지)
                if (translationHTML) {
                    // 번역 결과가 있는 경우: 교정된 문장과 번역 결과 모두 표시
                    chatCorrectionPreview.innerHTML = `
                        <h5>AI Correction Preview</h5>
                        <p><strong>교정된 문장</strong>: ${escapeHtml(correction.corrected)}</p>
                        ${translationHTML}
                    `;
                } else {
                    // 번역 결과가 없는 경우: 교정된 문장만 표시
                    chatCorrectionPreview.innerHTML = `
                        <h5>AI Correction Preview</h5>
                        <p><strong>교정된 문장</strong>: ${escapeHtml(correction.corrected)}</p>
                    `;
                }
            } catch (error) {
                console.error('AI 교정 오류:', error);
                
                // 에러 메시지 표시 (번역 결과는 유지)
                const existingHTML = chatCorrectionPreview.innerHTML;
                const translationMatch = existingHTML.match(/<p><strong>영어 번역<\/strong>:.*?<\/p>/);
                const translationHTML = translationMatch ? translationMatch[0] : '';
                
                if (translationHTML) {
                    // 번역 결과가 있는 경우: 교정 오류와 번역 결과 표시
                    chatCorrectionPreview.innerHTML = `
                        <h5>AI Correction Preview</h5>
                        <p class="placeholder" style="color: #ff6b6b;">교정 중 오류가 발생했습니다: ${escapeHtml(error.message)}</p>
                        ${translationHTML}
                    `;
                } else {
                    // 번역 결과가 없는 경우: 교정 오류만 표시
                    chatCorrectionPreview.innerHTML = `
                        <h5>AI Correction Preview</h5>
                        <p class="placeholder" style="color: #ff6b6b;">교정 중 오류가 발생했습니다: ${escapeHtml(error.message)}</p>
                    `;
                }
            }
        });
    }



});

function prepareViewerWords(viewerElement) {
    const textBlocks = viewerElement.querySelectorAll('.viewer-text');

    textBlocks.forEach(block => {
        if (block.dataset.enhanced === 'true') {
            return;
        }

        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                return node.nodeValue.trim().length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        });

        const textNodes = [];
        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        textNodes.forEach(node => {
            const parts = node.nodeValue.split(/(\s+)/);
            const fragment = document.createDocumentFragment();

            parts.forEach(part => {
                if (part.trim().length === 0) {
                    fragment.appendChild(document.createTextNode(part));
                } else {
                    const span = document.createElement('span');
                    span.className = 'viewer-word';
                    span.textContent = part;
                    fragment.appendChild(span);
                }
            });

            node.parentNode.replaceChild(fragment, node);
        });

        block.dataset.enhanced = 'true';
    });
}

async function getWordDefinitionFromAI(word) {
    const responseArea = document.getElementById('ai-response-area');

    if (!responseArea) {
        return;
    }

    responseArea.innerHTML = `🧐 <strong>${escapeHtml(word)}</strong>의 정보를 AI가 찾는 중...`;

    try {
        const model = createGeminiModel();
        if (!model) {
            responseArea.innerHTML = '❌ 에러: Google Gen AI SDK를 로드하지 못했습니다. index.html을 확인해주세요.';
            return;
        }

        const prompt = `당신은 영어 독서 학습 도우미입니다. 사용자에게 **${word}**에 대한 정보를 요청받았습니다.
아래 형식에 맞게 해당 단어의 뜻, 발음, 그리고 예문 하나를 한국어로 친절하게 설명해주세요.

**단어**: ${word}
**발음**: [발음을 국제음성기호(IPA)나 쉬운 표기로]
**뜻**: [간결하고 정확한 한국어 뜻]
**예문**: [단어가 포함된 영어 예문 및 그 한국어 번역]`;

        // generateContent 호출 (안전한 형식 사용)
        // 최신 SDK에서는 문자열 직접 전달 또는 객체 형식 모두 지원
        let result;
        try {
            // 먼저 문자열 직접 전달 시도
            result = await model.generateContent(prompt);
        } catch (stringError) {
            console.warn('문자열 직접 전달 실패, 객체 형식으로 재시도:', stringError.message);
            // 객체 형식으로 재시도
            result = await model.generateContent({
                contents: [{
                    role: 'user',
                    parts: [{ text: prompt }],
                }],
            });
        }

        if (!result || !result.response) {
            responseArea.innerHTML = '❌ 오류: 예상치 못한 응답 형식입니다. 콘솔을 확인하세요.';
            return;
        }

        // 최신 SDK에서는 response.text()가 함수이거나 직접 속성일 수 있음
        const text = typeof result.response.text === 'function' 
            ? result.response.text() 
            : (result.response.text || result.response.candidates?.[0]?.content?.parts?.[0]?.text || '');
        const formattedResponse = formatAIResponse(text);
        responseArea.innerHTML = `<h2>📚 AI 학습 보조: ${escapeHtml(word)}</h2>${formattedResponse}`;
    } catch (error) {
        console.error('Gemini API 호출 중 오류 발생:', error);
        responseArea.innerHTML = '❌ 오류 발생: AI 정보를 가져오는 데 실패했습니다. 콘솔을 확인해주세요.';
        showFallbackDefinition(word, responseArea, error);
    }
}

function showFallbackDefinition(word, responseArea, error) {
    const samples = {
        "thirteen": {
            pronunciation: "[ˈθɜːrˌtiːn]",
            meaning: "숫자 13을 의미합니다.",
            example: "There were thirteen books on the shelf. (선반 위에는 열세 권의 책이 있었다.)"
        },
        "bright": {
            pronunciation: "[braɪt]",
            meaning: "빛나거나 환한 상태를 뜻합니다.",
            example: "The bright morning lifted everyone's spirits. (밝은 아침은 모두의 기분을 띄워 주었다.)"
        },
        "cold": {
            pronunciation: "[koʊld]",
            meaning: "차갑거나 서늘한 상태를 말합니다.",
            example: "She wore a coat because the night was cold. (밤이 추워서 그녀는 코트를 입었다.)"
        }
    };

    const fallback = samples[word];

    if (fallback) {
        const fallbackMarkdown = [
            `**발음**: ${fallback.pronunciation}`,
            `**뜻**: ${fallback.meaning}`,
            `**예문**: ${fallback.example}`
        ].join('\n');

        responseArea.innerHTML = `
            <h2>📚 (임시) 학습 보조: ${escapeHtml(word)}</h2>
            ${formatAIResponse(fallbackMarkdown)}
            <p style="color:#995">⚠️ AI 응답을 불러오지 못해 준비된 예시 정보를 표시합니다.</p>
        `;
    } else {
        const message = escapeHtml(error?.message || '원인을 확인하려면 콘솔을 참고하세요.');
        responseArea.innerHTML = `
            ❌ AI 정보를 가져오는 데 실패했습니다.<br>
            <small style="color:#a55">(${message})</small>
        `;
    }
}

// 단어를 단어장에 저장하는 함수
function saveWordToVocabulary(wordData) {
    const savedWords = JSON.parse(localStorage.getItem('savedVocabulary') || '[]');
    const wordKey = wordData.word.toLowerCase().trim();
    
    // 중복 확인
    const existingIndex = savedWords.findIndex(w => w.word && w.word.toLowerCase().trim() === wordKey);
    
    if (existingIndex >= 0) {
        // 이미 존재하면 업데이트
        savedWords[existingIndex] = {
            ...wordData,
            savedAt: Date.now()
        };
    } else {
        // 새로 추가
        savedWords.push({
            ...wordData,
            savedAt: Date.now()
        });
    }
    
    localStorage.setItem('savedVocabulary', JSON.stringify(savedWords));
    console.log('✅ 단어가 단어장에 저장되었습니다:', wordData.word);
    
    // 단어장이 열려있으면 새로고침
    const vocabArea = document.getElementById('vocab-list');
    if (vocabArea && vocabArea.innerHTML.includes('단어장')) {
        loadSavedVocabulary();
    }
}

// 단어를 단어장에서 제거하는 함수
function removeWordFromVocabulary(word) {
    const savedWords = JSON.parse(localStorage.getItem('savedVocabulary') || '[]');
    const wordKey = word.toLowerCase().trim();
    
    const filteredWords = savedWords.filter(w => {
        const wKey = w.word ? w.word.toLowerCase().trim() : '';
        return wKey !== wordKey;
    });
    
    localStorage.setItem('savedVocabulary', JSON.stringify(filteredWords));
    console.log('✅ 단어가 단어장에서 제거되었습니다:', word);
    
    // 단어장이 열려있으면 새로고침
    const vocabArea = document.getElementById('vocab-list');
    if (vocabArea && vocabArea.innerHTML.includes('단어장')) {
        loadSavedVocabulary();
    }
}

// 전역 스코프에 함수 노출 (viewer.js에서 사용)
window.saveWordToVocabulary = saveWordToVocabulary;
window.removeWordFromVocabulary = removeWordFromVocabulary;
window.loadSavedVocabulary = loadSavedVocabulary;

// 저장된 단어장을 표시하는 함수
function loadSavedVocabulary() {
    const vocabArea = document.getElementById('vocab-list');
    if (!vocabArea) {
        return;
    }
    
    const savedWords = JSON.parse(localStorage.getItem('savedVocabulary') || '[]');
    
    if (savedWords.length === 0) {
        vocabArea.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #666;">
                <p style="font-size: 1.1rem; margin-bottom: 10px;">📘 단어장이 비어있습니다</p>
                <p style="font-size: 0.9rem; color: #999;">원서 텍스트에서 단어를 클릭하고 즐겨찾기 버튼을 눌러 단어를 저장하세요.</p>
            </div>
        `;
        return;
    }
    
    // 최신 순으로 정렬
    const sortedWords = savedWords.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    
    const wordsList = sortedWords.map((wordData, index) => {
        const savedDate = new Date(wordData.savedAt || Date.now());
        const dateStr = savedDate.toLocaleDateString('ko-KR', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
        
        return `
            <div class="vocab-word-item" data-word-index="${index}" style="padding: 16px; margin-bottom: 12px; background: #f9f9f9; border-radius: 8px; border-left: 3px solid #4a90e2; position: relative;">
                <button 
                    class="delete-vocab-word-btn" 
                    data-word="${escapeHtml(wordData.word || '')}"
                    style="position: absolute; top: 12px; right: 12px; background: #ffffff; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; color: #000000; padding: 0;"
                    title="단어 삭제"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
                <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: bold; color: #333; padding-right: 40px;">
                    ⭐ ${escapeHtml(wordData.word || '단어')}
                </h3>
                <p style="margin: 0 0 6px 0; font-size: 14px; color: #666;">
                    <strong>발음</strong>: ${escapeHtml(wordData.pronunciation || '발음 정보 없음')}
                </p>
                <p style="margin: 0 0 6px 0; font-size: 14px; color: #666;">
                    <strong>뜻</strong>: ${escapeHtml(wordData.meaning || '의미 정보 없음')}
                </p>
                <p style="margin: 0 0 6px 0; font-size: 14px; color: #666;">
                    <strong>예문</strong>: ${escapeHtml(wordData.example || '예문 정보 없음')}
                </p>
                <small style="color: #999; font-size: 12px;">저장일: ${dateStr}</small>
            </div>
        `;
    }).join('');
    
    vocabArea.innerHTML = `
        <h2 style="margin-bottom: 16px; font-size: 20px; color: #333;">📘 내 단어장 (${savedWords.length}개)</h2>
        <div class="vocab-words-container">
            ${wordsList}
        </div>
    `;
    
    // 삭제 버튼 이벤트 리스너 추가
    const deleteButtons = vocabArea.querySelectorAll('.delete-vocab-word-btn');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const word = btn.dataset.word;
            if (confirm(`"${word}" 단어를 단어장에서 삭제하시겠습니까?`)) {
                removeWordFromVocabulary(word);
                loadSavedVocabulary();
            }
        });
        
        // 호버 효과
        btn.addEventListener('mouseenter', () => {
            btn.style.background = '#f5f5f5';
            btn.style.transform = 'scale(1.1)';
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.background = '#ffffff';
            btn.style.transform = 'scale(1)';
        });
    });
}

async function getVocabularyListFromAI(words) {
    const vocabArea = document.getElementById('vocab-list');

    if (!vocabArea) {
        return;
    }

    vocabArea.innerHTML = '📘 AI가 단어장을 작성하는 중입니다...';

    try {
        // 서버의 /api/vocabulary 엔드포인트 호출
        const response = await fetch('http://127.0.0.1:11304/api/vocabulary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // 세션 쿠키를 포함
            body: JSON.stringify({
                words: words
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            // 403 오류 (API 키 유출) 처리
            if (response.status === 403) {
                vocabArea.innerHTML = `
                    <p style="color: #ff6b6b;">❌ Gemini API 키가 유출되어 차단되었습니다.</p>
                    <p style="color: #666; font-size: 0.9rem; margin-top: 10px;">
                        새로운 API 키를 발급받아 서버의 .env 파일에 설정해주세요.<br>
                        <a href="https://aistudio.google.com/apikey" target="_blank" style="color: #4a90e2; text-decoration: underline;">
                            Google AI Studio에서 새 API 키 발급받기
                        </a>
                    </p>
                `;
                return;
            }
            
            throw new Error(errorData.message || `서버 오류: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.vocabulary) {
            // 인사말 및 불필요한 설명 제거
            let text = data.vocabulary
                .replace(/^.*?안녕하세요[^]*?요청하신[^]*?궁금한 점[^]*?질문해주세요[^]*?---/gi, '') // 인사말 제거
                .replace(/^.*?영어 학습 튜터입니다[^]*?---/gi, '') // 설명 제거
                .replace(/^.*?---\s*/g, '') // 구분선 제거
                .replace(/^\s*📝\s*AI\s*단어장\s*\n*/i, '') // 제목 제거
                .trim();

            const formattedResponse = formatAIResponse(text);
            vocabArea.innerHTML = `<h2>📝 AI 단어장</h2>${formattedResponse}`;
        } else {
            throw new Error('단어장 결과를 받을 수 없습니다.');
        }
    } catch (error) {
        console.error('Gemini API 단어장 생성 중 오류 발생:', error);
        
        vocabArea.innerHTML = `❌ 오류 발생: 단어장을 가져오는 데 실패했습니다. ${escapeHtml(error.message)}`;
        showFallbackVocabulary(words, vocabArea, error);
    }
}

function collectViewerWords(viewerElement, limit = 12) {
    if (!viewerElement) {
        return [];
    }
    
    // viewer.js의 loadChapter가 생성한 .word 요소들에서 단어 수집
    // .chapter-text div 내부의 .word 요소도 포함하여 검색
    const wordElements = viewerElement.querySelectorAll('.word');
    
    // .chapter-text div 내부에서도 시도
    const chapterTextDiv = viewerElement.querySelector('.chapter-text');
    if (chapterTextDiv) {
        const wordsInChapterText = chapterTextDiv.querySelectorAll('.word');
        
        if (wordsInChapterText.length > 0) {
            const textContent = Array.from(wordsInChapterText)
                .map(el => el.textContent.trim())
                .join(' ')
                .toLowerCase();

            const tokens = textContent.match(/[a-z']+/g);
            if (!tokens) {
                return [];
            }

            const stopWords = new Set([
                'the', 'and', 'is', 'was', 'were', 'in', 'on', 'at', 'to', 'a', 'an', 'of', 'for',
                'with', 'as', 'by', 'it', 'this', 'that', 'from', 'be', 'or', 'but', 'are', 'his',
                'her', 'their', 'he', 'she', 'they', 'we', 'you', 'i'
            ]);

            const uniqueWords = [];
            tokens.forEach(token => {
                if (!stopWords.has(token) && !uniqueWords.includes(token)) {
                    uniqueWords.push(token);
                }
            });

            return uniqueWords.slice(0, limit);
        }
    }
    
    if (wordElements.length > 0) {
        // .word 요소가 있으면 (viewer.js로 로드된 경우)
        const textContent = Array.from(wordElements)
            .map(el => el.textContent.trim())
            .join(' ')
            .toLowerCase();

        const tokens = textContent.match(/[a-z']+/g);
        if (!tokens) {
            return [];
        }

        const stopWords = new Set([
            'the', 'and', 'is', 'was', 'were', 'in', 'on', 'at', 'to', 'a', 'an', 'of', 'for',
            'with', 'as', 'by', 'it', 'this', 'that', 'from', 'be', 'or', 'but', 'are', 'his',
            'her', 'their', 'he', 'she', 'they', 'we', 'you', 'i'
        ]);

        const uniqueWords = [];
        tokens.forEach(token => {
            if (!stopWords.has(token) && !uniqueWords.includes(token)) {
                uniqueWords.push(token);
            }
        });

        return uniqueWords.slice(0, limit);
    }

    // 기존 방식: .viewer-level.active와 .viewer-text 구조 (하위 호환성)
    const activeLevel = viewerElement.querySelector('.viewer-level.active');
    if (!activeLevel) {
        return [];
    }

    const textContent = Array.from(activeLevel.querySelectorAll('.viewer-text'))
        .map(block => block.innerText || '')
        .join(' ')
        .toLowerCase();

    const tokens = textContent.match(/[a-z']+/g);
    if (!tokens) {
        return [];
    }

    const stopWords = new Set([
        'the', 'and', 'is', 'was', 'were', 'in', 'on', 'at', 'to', 'a', 'an', 'of', 'for',
        'with', 'as', 'by', 'it', 'this', 'that', 'from', 'be', 'or', 'but', 'are', 'his',
        'her', 'their', 'he', 'she', 'they', 'we', 'you', 'i'
    ]);

    const uniqueWords = [];
    tokens.forEach(token => {
        if (!stopWords.has(token) && !uniqueWords.includes(token)) {
            uniqueWords.push(token);
        }
    });

    return uniqueWords.slice(0, limit);
}

function showFallbackVocabulary(words, vocabArea, error) {
    const limitedWords = words.slice(0, 5);

    if (!limitedWords.length) {
        vocabArea.innerHTML = `❌ 단어장을 구성할 단어가 없습니다.<br>
        <small style="color:#a55">(${error?.message || '텍스트 내용을 확인해주세요.'})</small>`;
        return;
    }

    const items = limitedWords.map(word => `
        <li><strong>${escapeHtml(word)}</strong> — 추후 AI 설명을 통해 의미를 확인해 보세요.</li>
    `).join('');

    vocabArea.innerHTML = `
        <h2>📝 (임시) 단어장</h2>
        <ul>${items}</ul>
        <p style="color:#995">⚠️ AI 응답을 불러오지 못해 간단한 단어 목록만 제공합니다.</p>
    `;
}

function createGeminiModel() {
    // 보안상 클라이언트에서 직접 Gemini API를 호출하지 않습니다.
    // 모든 Gemini API 호출은 서버를 통해 이루어집니다.
    console.warn('⚠️ 클라이언트에서 직접 Gemini API를 호출할 수 없습니다. 서버를 통해 호출해주세요.');
    return null;
    
    // 아래 코드는 보안상 비활성화되었습니다.
    /*
    // GoogleGenerativeAI 확인
    if (!window.GoogleGenerativeAI) {
        console.error('Google Generative AI SDK가 로드되지 않았습니다.');
        console.error('window.GoogleGenerativeAI:', window.GoogleGenerativeAI);
        console.error('window.GoogleGenAI:', window.GoogleGenAI); // 디버깅용 (구버전 호환)
        return null;
    }

    try {
        // GoogleGenerativeAI 인스턴스 생성 (생성자에 API 키 직접 전달)
        const genAI = new window.GoogleGenerativeAI(GEMINI_API_KEY);
        
        console.log('🔄 Gemini 모델 생성 시도:', GEMINI_MODEL_ID);
        console.log('DEBUG: GoogleGenerativeAI 인스턴스:', !!genAI);
        
        // 모델 가져오기 (기본 설정 사용)
        const model = genAI.getGenerativeModel({ 
            model: GEMINI_MODEL_ID
        });
        
        console.log('✅ Gemini 모델 생성 성공:', GEMINI_MODEL_ID);
        console.log('DEBUG: 모델 객체:', !!model);
        return model;
    } catch (error) {
        console.error('❌ Gemini 모델 생성 실패:', error);
        console.error('에러 상세:', error.message);
        console.error('에러 스택:', error.stack);
        
        // 대체 모델 시도 (여러 모델 순차적으로 시도)
        const fallbackModels = [
            'gemini-1.5-pro',  // Pro 버전 시도
            'gemini-pro'       // 구버전 모델 (최후의 수단)
        ];
        
        for (const fallbackModelId of fallbackModels) {
            if (GEMINI_MODEL_ID === fallbackModelId) {
                continue; // 이미 시도한 모델은 건너뛰기
            }
            
            console.log(`🔄 대체 모델(${fallbackModelId})로 재시도...`);
            try {
                const genAI = new window.GoogleGenerativeAI(GEMINI_API_KEY);
                const fallbackModel = genAI.getGenerativeModel({ model: fallbackModelId });
                console.log(`✅ 대체 모델(${fallbackModelId}) 생성 성공`);
                return fallbackModel;
            } catch (fallbackError) {
                console.warn(`⚠️ 대체 모델(${fallbackModelId}) 실패:`, fallbackError.message);
                // 다음 모델 시도
            }
        }
        
        return null;
    }
    */
}

function formatAIResponse(markdown = '') {
    if (!markdown) {
        return '<p>표시할 정보가 없습니다.</p>';
    }

    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const htmlParts = [];
    let listType = null;

    const closeList = () => {
        if (listType === 'ul') {
            htmlParts.push('</ul>');
        } else if (listType === 'ol') {
            htmlParts.push('</ol>');
        }
        listType = null;
    };

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) {
            closeList();
            return;
        }

        if (/^[-*]\s+/.test(trimmed)) {
            if (listType !== 'ul') {
                closeList();
                htmlParts.push('<ul>');
                listType = 'ul';
            }
            const content = applyInlineMarkdown(trimmed.replace(/^[-*]\s+/, ''));
            htmlParts.push(`<li>${content}</li>`);
            return;
        }

        if (/^\d+\.\s+/.test(trimmed)) {
            if (listType !== 'ol') {
                closeList();
                htmlParts.push('<ol>');
                listType = 'ol';
            }
            const content = applyInlineMarkdown(trimmed.replace(/^\d+\.\s+/, ''));
            htmlParts.push(`<li>${content}</li>`);
            return;
        }

        closeList();

        if (/^###\s+/.test(trimmed)) {
            htmlParts.push(`<h3>${applyInlineMarkdown(trimmed.replace(/^###\s+/, ''))}</h3>`);
            return;
        }

        if (/^##\s+/.test(trimmed)) {
            htmlParts.push(`<h2>${applyInlineMarkdown(trimmed.replace(/^##\s+/, ''))}</h2>`);
            return;
        }

        if (/^#\s+/.test(trimmed)) {
            htmlParts.push(`<h1>${applyInlineMarkdown(trimmed.replace(/^#\s+/, ''))}</h1>`);
            return;
        }

        htmlParts.push(`<p>${applyInlineMarkdown(trimmed)}</p>`);
    });

    closeList();

    return htmlParts.join('');
}

function applyInlineMarkdown(text) {
    let html = escapeHtml(text);
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    return html;
}

function escapeHtml(str = '') {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * 읽은 책 목록을 가져오는 전역 함수
 * @returns {Array} 읽은 책 목록
 */
function getReadBooks() {
    // localStorage에서 읽은 책 목록 가져오기 (최신 순)
    const readBooks = JSON.parse(localStorage.getItem('readBooks') || '[]');
    
    // 기본 책 목록 (예시 데이터)
    const defaultBooks = [
        { id: '1984', title: '1984', author: 'George Orwell', completedAt: Date.now() - 86400000 },
        { id: 'mockingbird', title: 'To Kill a Mockingbird', author: 'Harper Lee', completedAt: Date.now() - 172800000 },
        { id: 'gatsby', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', completedAt: Date.now() - 259200000 },
        { id: 'pride', title: 'Pride and Prejudice', author: 'Jane Austen', completedAt: Date.now() - 345600000 }
    ];
    
    // 읽은 책이 없으면 기본 목록 반환
    if (readBooks.length === 0) {
        return defaultBooks;
    }
    
    // 최신 순으로 정렬 (completedAt 기준 내림차순)
    return readBooks.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
}

function showPage(pageId) {
    const pages = document.querySelectorAll('[id$="-page"]');
    pages.forEach(page => {
        page.style.display = 'none';
    });

    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.style.display = 'block';
        
        // 커뮤니티 룸 페이지가 표시될 때 채팅 입력 필드 활성화
        if (pageId === 'community-room-page') {
            initializeChatInput();
        }
        
        // 지도 페이지가 표시될 때 Google Maps API 로드
        if (pageId === 'map-page') {
            loadGoogleMapsAPI();
        }
        
        // 마이페이지가 표시될 때 독서 기록 불러오기
        if (pageId === 'mypage-page') {
            loadReadingRecords();
        }
    }
}

// 채팅 입력 필드 초기화 함수
function initializeChatInput() {
    const chatInput = document.getElementById('chat-input');
    const chatCorrectionBtn = document.getElementById('ai-correction-btn');
    const chatCorrectionPreview = document.getElementById('ai-correction-preview');
    
    // 채팅 입력 필드 활성화
    if (chatInput) {
        chatInput.disabled = false;
        chatInput.readOnly = false;
        chatInput.style.pointerEvents = 'auto';
        chatInput.style.opacity = '1';
    }
    
    // AI 교정 버튼 활성화
    if (chatCorrectionBtn) {
        chatCorrectionBtn.disabled = false;
        chatCorrectionBtn.style.pointerEvents = 'auto';
        chatCorrectionBtn.style.opacity = '1';
    }
    
    // 전송 버튼 활성화
    const sendBtn = document.querySelector('.send-btn');
    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.style.pointerEvents = 'auto';
        sendBtn.style.opacity = '1';
    }
}

window.showPage = showPage;

// 페이지 로드 시 마이페이지 표시 및 스크롤 상단으로 이동
document.addEventListener('DOMContentLoaded', function() {
    showPage('mypage-page');
    // 스크롤을 상단으로 이동
    window.scrollTo(0, 0);
});

// 페이지 로드 완료 후에도 스크롤 위치 확인 및 조정
window.addEventListener('load', function() {
    window.scrollTo(0, 0);
});

// 현재 선택된 챕터 번호를 저장하는 변수
let currentViewerChapter = 1;
let currentBookTitle = null; // 현재 선택된 책 제목 저장
let currentViewerLevel = 'beginner'; // 현재 선택된 레벨 저장
let cachedTotalChapters = null; // 캐시된 총 챕터 수

// 현재 챕터 번호 가져오기
function getCurrentChapter() {
    return currentViewerChapter;
}

// 레벨별 챕터 범위 정의 함수
function getChaptersForLevel(level, totalChapters) {
    // The Great Gatsby는 총 9챕터로 레벨당 3개씩 구성
    if (totalChapters === 9) {
        switch(level) {
            case 'beginner':
                return { start: 1, end: 3 };
            case 'intermediate':
                return { start: 4, end: 6 };
            case 'advanced':
                return { start: 7, end: 9 };
            default:
                return { start: 1, end: 3 };
        }
    }
    
    // 다른 책들은 총 챕터 수를 3등분 (예: 61챕터 -> Beginner: 1-20, Intermediate: 21-40, Advanced: 41-61)
    const chunkSize = Math.ceil(totalChapters / 3);
    
    switch(level) {
        case 'beginner':
            return { start: 1, end: chunkSize };
        case 'intermediate':
            return { start: chunkSize + 1, end: chunkSize * 2 };
        case 'advanced':
            return { start: chunkSize * 2 + 1, end: totalChapters };
        default:
            return { start: 1, end: chunkSize };
    }
}

// 목차에 책 이름 업데이트 및 동적 생성 함수 (레벨별 필터링)
async function updateTableOfContents(bookTitle, totalChapters = null, level = null) {
    const tocList = document.querySelector('.toc-list');
    if (!tocList) return;
    
    // 현재 선택된 레벨 가져오기
    if (!level) {
        const activeLevelBtn = document.querySelector('.level-toggle .level-btn.active');
        level = activeLevelBtn ? activeLevelBtn.dataset.level : 'beginner';
    }
    currentViewerLevel = level;
    
    // total_chapters가 제공되지 않으면 첫 번째 챕터를 로드해서 가져오기
    if (!totalChapters && bookTitle) {
        // 캐시된 값이 있으면 사용
        if (cachedTotalChapters) {
            totalChapters = cachedTotalChapters;
        } else {
            // The Great Gatsby인 경우 JSON 파일에서 직접 읽기
            if (bookTitle === 'The Great Gatsby' || bookTitle === 'The_Great_Gatsby' || bookTitle.includes('Gatsby')) {
                try {
                    // 절대 경로 사용
                    const jsonUrl = window.location.origin + '/data/The_Great_Gatsby_chapters.json';
                    const jsonResponse = await fetch(jsonUrl);
                    if (jsonResponse.ok) {
                        const jsonData = await jsonResponse.json();
                        totalChapters = jsonData.total_chapters || jsonData.chapters.length;
                        cachedTotalChapters = totalChapters;
                        console.log(`✅ The Great Gatsby 챕터 수: ${totalChapters} (JSON 파일에서)`);
                    } else {
                        totalChapters = 10; // 기본값 (The Great Gatsby)
                        cachedTotalChapters = 10;
                        console.warn(`⚠️ JSON 파일 로드 실패 (HTTP ${jsonResponse.status}), 기본값 10 사용`);
                    }
                } catch (error) {
                    console.error('❌ JSON 파일 로드 오류:', error);
                    totalChapters = 10; // 기본값 (The Great Gatsby)
                    cachedTotalChapters = 10;
                }
            } else {
                // 기존 API 방식 (다른 책들)
                try {
                    const encodedBookTitle = encodeURIComponent(bookTitle);
                    const response = await fetch(`http://localhost:11304/api/book/chapter/${encodedBookTitle}/1`);
                    if (response.ok) {
                        const data = await response.json();
                        // 서버 응답에서 total_chapters 가져오기
                        totalChapters = data.total_chapters || 61; // 기본값 61 (Pride and Prejudice)
                        cachedTotalChapters = totalChapters; // 캐시에 저장
                    }
                } catch (error) {
                    totalChapters = 61; // 기본값 (Pride and Prejudice)
                    cachedTotalChapters = 61;
                }
            }
        }
    }
    
    // totalChapters가 없으면 기본값 61 사용 (Pride and Prejudice)
    if (!totalChapters) {
        totalChapters = 61;
        cachedTotalChapters = 61;
    }
    
    // 레벨별 챕터 범위 가져오기
    const chapterRange = getChaptersForLevel(level, totalChapters);
    
    // 기존 목차 제거
    tocList.innerHTML = '';
    
    // 해당 레벨의 챕터만 목차에 추가
    for (let i = chapterRange.start; i <= chapterRange.end; i++) {
        const listItem = document.createElement('li');
        const link = document.createElement('a');
        link.href = `#chapter-${i}`;
        link.textContent = `${String(i).padStart(2, '0')}. Chapter ${i} ${bookTitle ? `[${bookTitle}]` : ''}`;
        listItem.appendChild(link);
        tocList.appendChild(listItem);
    }
    
    // 목차 링크에 클릭 이벤트 다시 추가
    const tocLinks = document.querySelectorAll('.toc-list a');
    tocLinks.forEach(link => {
        // 기존 이벤트 리스너 제거를 위해 클론
        const newLink = link.cloneNode(true);
        link.parentNode.replaceChild(newLink, link);
        
        newLink.addEventListener('click', async function(e) {
            e.preventDefault();
            const href = this.getAttribute('href');
            const chapterMatch = href.match(/#chapter-(\d+)/);
            if (chapterMatch) {
                const chapterNumber = parseInt(chapterMatch[1]);
                
                if (!currentBookTitle) {
                    console.warn('⚠️ 책이 선택되지 않았습니다. 먼저 책을 선택해주세요.');
                    alert('책을 먼저 선택해주세요.');
                    return;
                }
                
                // 선택한 챕터가 현재 레벨 범위에 있는지 확인
                const currentRange = getChaptersForLevel(currentViewerLevel, totalChapters);
                if (chapterNumber < currentRange.start || chapterNumber > currentRange.end) {
                    alert(`이 챕터는 ${currentViewerLevel} 레벨에서 사용할 수 없습니다.`);
                    return;
                }
                
                console.log(`📖 목차에서 챕터 ${chapterNumber} 선택: ${currentBookTitle} (${currentViewerLevel} 레벨)`);
                
                if (typeof loadChapter === 'function') {
                    try {
                        await loadChapter(currentBookTitle, chapterNumber);
                        currentViewerChapter = chapterNumber;
                        
                        const viewerElement = document.getElementById('original-text-viewer');
                        if (viewerElement) {
                            viewerElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    } catch (error) {
                        console.error('❌ 챕터 로드 오류:', error);
                        alert(`챕터를 불러오는 중 오류가 발생했습니다: ${error.message}`);
                    }
                } else {
                    console.error('❌ loadChapter 함수를 찾을 수 없습니다.');
                }
            }
        });
    });
}

// AI 뷰어에 챕터 내용 로드
function loadChapterForViewer(chapterNumber, level) {
    const viewer = document.getElementById('original-text-viewer');
    if (!viewer) return;

    const chapterData = chapterTexts[chapterNumber] || chapterTexts[1];
    if (!chapterData) return;

    // 현재 챕터 번호 저장
    currentViewerChapter = chapterNumber;

    // 해당 레벨의 텍스트 가져오기
    const texts = chapterData[level] || chapterData.beginner;

    // viewer-level 요소들 업데이트
    const viewerLevels = viewer.querySelectorAll('.viewer-level');
    viewerLevels.forEach(section => {
        const sectionLevel = section.dataset.level;
        if (sectionLevel === level) {
            // 해당 레벨의 내용 업데이트
            section.innerHTML = texts.map(text => `<p class="viewer-text">${text}</p>`).join('');
        }
    });

    // 활성 레벨 표시 업데이트
    const activeLevelBtn = document.querySelector('.level-toggle .level-btn.active');
    if (activeLevelBtn) {
        showViewerLevel(level, viewer, document.querySelectorAll('.level-toggle .level-btn'));
    }

    // 단어 래핑 다시 적용
    prepareViewerWords(viewer);
    viewer.scrollTop = 0;
    hideWordTooltip();
}

function showViewerLevel(level, viewerElement, buttons) {
    const viewerLevels = viewerElement.querySelectorAll('.viewer-level');

    buttons.forEach(button => {
        const isActive = button.dataset.level === level;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-selected', String(isActive));
    });

    let activated = false;
    viewerLevels.forEach(section => {
        const isActive = section.dataset.level === level;
        section.classList.toggle('active', isActive);
        if (isActive) {
            activated = true;
        }
    });

    if (!activated && viewerLevels.length) {
        viewerLevels[0].classList.add('active');
        buttons.forEach((button, index) => {
            const isFallback = index === 0;
            button.classList.toggle('active', isFallback);
            button.setAttribute('aria-selected', String(isFallback));
        });
    }

    prepareViewerWords(viewerElement);
    viewerElement.scrollTop = 0;
    hideWordTooltip();
}

function showToolsTab(tabId, toolsContentElement, buttons) {
    const panes = toolsContentElement.querySelectorAll('.tools-pane');

    buttons.forEach(button => {
        const isActive = button.dataset.tab === tabId;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-selected', String(isActive));
    });

    let activated = false;
    panes.forEach(pane => {
        const isActive = pane.dataset.tab === tabId;
        pane.classList.toggle('active', isActive);
        if (isActive) {
            activated = true;
        }
    });

    if (!activated && panes.length) {
        panes[0].classList.add('active');
        buttons.forEach((button, index) => {
            const isFallback = index === 0;
            button.classList.toggle('active', isFallback);
            button.setAttribute('aria-selected', String(isFallback));
        });
    }
}

function showWordTooltip(targetElement, word) {
    const tooltipData = getDummyTooltipData(word);
    if (!tooltipData) {
        hideWordTooltip();
        return;
    }

    if (!activeWordTooltip) {
        activeWordTooltip = document.createElement('div');
        activeWordTooltip.className = 'word-tooltip';
        document.body.appendChild(activeWordTooltip);
    }

    activeWordTooltip.innerHTML = `
        <h5>${escapeHtml(tooltipData.word)}</h5>
        <p><strong>Pronunciation</strong>: ${escapeHtml(tooltipData.pronunciation)}</p>
        <p><strong>Meaning</strong>: ${escapeHtml(tooltipData.meaning)}</p>
        <p><strong>Example</strong>: ${escapeHtml(tooltipData.example)}</p>
        <small>AI Preview · 더 자세한 내용은 곧 제공됩니다</small>
    `;

    const rect = targetElement.getBoundingClientRect();
    const tooltipRect = activeWordTooltip.getBoundingClientRect();
    const top = window.scrollY + rect.top - tooltipRect.height - 12;
    const left = window.scrollX + rect.left + (rect.width / 2) - (tooltipRect.width / 2);

    activeWordTooltip.style.top = `${Math.max(12, top)}px`;
    activeWordTooltip.style.left = `${Math.max(12, left)}px`;

    requestAnimationFrame(() => {
        activeWordTooltip.classList.add('visible');
    });
}

function hideWordTooltip() {
    if (activeWordTooltip) {
        activeWordTooltip.classList.remove('visible');
    }
}

function getDummyTooltipData(word) {
    const samples = {
        "winston": {
            word: "Winston",
            pronunciation: "[wɪn-stən]",
            meaning: "소설 속 주인공의 이름입니다.",
            example: "Winston jotted down a note in his diary."
        },
        "morning": {
            word: "morning",
            pronunciation: "[ˈmɔːrnɪŋ]",
            meaning: "하루의 시작, 아침을 뜻합니다.",
            example: "The morning breeze felt refreshing."
        },
        "clock": {
            word: "clock",
            pronunciation: "[klɑːk]",
            meaning: "시간을 알려 주는 도구, 시계.",
            example: "The clock struck thirteen in the story."
        },
        "memory": {
            word: "memory",
            pronunciation: "[ˈmeməri]",
            meaning: "사람이 과거를 기억하는 능력 또는 기억.",
            example: "His memory of the past was vivid."
        }
    };

    return samples[word] || {
        word,
        pronunciation: "[coming soon]",
        meaning: "AI가 곧 제공할 예정인 단어 정보입니다.",
        example: "Additional examples will be added later."
    };
}

function getCommunityRoomInfo(roomId) {
    const rooms = {
        'room-gatsby-dream': {
            title: 'The American Dream and Its Illusions',
            meta: '실시간 참여 인원 · 3명',
            level: 'beginner',
            book: 'The Great Gatsby'
        },
        'room-gatsby-class': {
            title: 'Social Class and Identity',
            meta: '실시간 참여 인원 · 4명',
            level: 'intermediate',
            book: 'The Great Gatsby'
        },
        'room-gatsby-symbol': {
            title: 'Symbolism and Narrative Techniques',
            meta: '실시간 참여 인원 · 2명',
            level: 'advanced',
            book: 'The Great Gatsby'
        },
        'room-pride-love': {
            title: 'Love, Marriage, and Social Expectations',
            meta: '실시간 참여 인원 · 5명',
            level: 'intermediate',
            book: 'Pride and Prejudice'
        }
    };

    return rooms[roomId] || rooms['room-gatsby-dream'];
}

// 원문 참조 패널에 레벨에 맞는 원서 로드
// 챕터별 원서 데이터
const chapterTexts = {
    1: {
        title: "Chapter 1. The Clock Strikes",
        beginner: [
            "The morning air felt crisp as Winston opened the window. Sunlight touched the pages of his worn diary, and the quiet street below seemed peaceful for a moment.",
            "He wrote simple sentences about the day, promising himself to stay hopeful. Even small words carried meaning when they were spoken with care."
        ],
        intermediate: [
            "Winston paused, letting the cool spring breeze filter through the curtains while the distant chime of thirteen echoed from the clocktower. The sound was familiar yet unsettling, a persistent reminder that ordinary routines were shaped by unseen hands.",
            "He scribbled in his journal about fleeting moments of kindness he noticed in the city. Though subtle, each gesture hinted that quiet resistance might bloom in unexpected places."
        ],
        advanced: [
            "Perched beside the narrow window, Winston contemplated the paradox of solitude within a crowded metropolis. The clocks' aberrant toll, striking thirteen, resonated like a ciphered warning threaded through the fabric of a regimented society.",
            "In his journal he catalogued aberrations—the nuanced inflections in public speeches, the delicate rebellions disguised as courteous smiles. Each observation became an act of intellectual preservation against the gradual erosion of truth."
        ]
    },
    2: {
        title: "Chapter 2. Ministry of Truth",
        beginner: [
            "Winston walked into the large building where he worked. The walls were white and clean. People moved quietly through the halls, each focused on their tasks.",
            "He sat at his desk and began to change old news articles. This was his job: to make the past match what the Party said was true."
        ],
        intermediate: [
            "The Ministry of Truth stood as a monument to controlled memory. Winston navigated its corridors, aware that every document he altered was a deliberate erasure of what once existed.",
            "At his workstation, he methodically rewrote history, replacing inconvenient facts with Party-approved narratives. Each deletion felt like a small betrayal of the truth he once knew."
        ],
        advanced: [
            "Within the monolithic structure of the Ministry of Truth, Winston engaged in the systematic reconstruction of historical reality. The architecture itself seemed designed to suppress individual thought, with its sterile corridors and uniform workspaces.",
            "His daily task involved the meticulous manipulation of archival records, transforming documented events into Party-sanctioned versions. This process of historical revisionism required both technical precision and moral compromise."
        ]
    },
    3: {
        title: "Chapter 3. Memory and Dreams",
        beginner: [
            "That night, Winston dreamed of his mother. The dream was clear and warm. He remembered her face and her gentle voice.",
            "When he woke up, the memory felt real. But he knew that memories could be dangerous. The Party did not like people to remember the past."
        ],
        intermediate: [
            "Dreams became Winston's secret archive of forbidden memories. In sleep, he accessed fragments of a past that the Party had systematically erased from public consciousness.",
            "The dream of his mother carried emotional weight that contradicted Party doctrine about family bonds. Upon waking, he recognized these memories as both precious and perilous."
        ],
        advanced: [
            "Winston's subconscious became a repository for suppressed historical and personal narratives. His dreams functioned as involuntary resistance against the Party's program of collective amnesia.",
            "The vivid recollection of his mother represented an emotional authenticity that contradicted the Party's redefinition of human relationships. These nocturnal memories constituted a form of cognitive dissent."
        ]
    },
    4: {
        title: "Chapter 4. Resistance Notes",
        beginner: [
            "Winston found a small piece of paper in an old book. He wrote his thoughts on it, knowing this was against the rules.",
            "He wrote about freedom and truth. These words were dangerous, but writing them made him feel alive again."
        ],
        intermediate: [
            "The discovery of the paper fragment represented a tangible connection to forbidden expression. Winston used it to document thoughts that existed outside Party-approved discourse.",
            "His clandestine writing addressed concepts of individual autonomy and objective truth—ideas that the Party had systematically eliminated from public language and thought."
        ],
        advanced: [
            "The paper fragment became a medium for subversive documentation. Winston's annotations constituted a deliberate act of intellectual resistance against the Party's linguistic and cognitive control.",
            "Through these encoded writings, he attempted to preserve concepts of personal liberty and empirical truth that the Party had methodically excised from collective consciousness and vocabulary."
        ]
    }
};

// 현재 원문 참조 패널의 레벨을 저장하는 전역 변수
let currentReferenceLevel = 'beginner';
let currentReferenceBook = null; // 현재 참조 중인 책 제목

async function loadOriginalTextForRoom(roomId, level) {
    const referencePassage = document.getElementById('reference-passage');
    const referencePanelContent = document.getElementById('reference-panel-content');
    const referencePanel = document.getElementById('reference-panel');
    const referenceLevelContents = document.querySelectorAll('.reference-level-content');
    const referenceLevelToggle = document.querySelector('.reference-level-toggle');
    const chapterSelect = document.getElementById('reference-chapter-select');
    
    if (!referencePassage || !referencePanelContent) return;
    
    // 현재 레벨 저장
    currentReferenceLevel = level;
    
    // 토론방의 책 정보 가져오기
    const communities = JSON.parse(localStorage.getItem('userCommunities') || '[]');
    const userCommunity = communities.find(c => c.id === roomId);
    const roomInfo = getCommunityRoomInfo(roomId);
    const bookTitle = (userCommunity && userCommunity.book) || (roomInfo && roomInfo.book);
    
    // 책 정보가 없으면 원문 참조 패널 숨기기
    if (!bookTitle) {
        if (referencePanel) {
            referencePanel.style.display = 'none';
        }
        return;
    }
    
    currentReferenceBook = bookTitle;
    
    // The Great Gatsby는 JSON 파일에서 로드, 다른 책은 MongoDB에서 확인
    let bookExists = false;
    let totalChapters = 61; // 기본값
    
    if (bookTitle === 'The Great Gatsby' || bookTitle.includes('Gatsby')) {
        // The Great Gatsby는 JSON 파일에서 로드
        try {
            const jsonUrl = window.location.origin + '/data/The_Great_Gatsby_chapters.json';
            const jsonResponse = await fetch(jsonUrl);
            if (jsonResponse.ok) {
                const jsonData = await jsonResponse.json();
                bookExists = true;
                totalChapters = jsonData.total_chapters || 9;
            } else {
                // JSON 파일이 없으면 원문 참조 패널 숨기기
                if (referencePanel) {
                    referencePanel.style.display = 'none';
                }
                return;
            }
        } catch (error) {
            console.error('The Great Gatsby JSON 파일 로드 실패:', error);
            if (referencePanel) {
                referencePanel.style.display = 'none';
            }
            return;
        }
    } else {
        // 다른 책들은 MongoDB에서 확인
        try {
            const encodedBookTitle = encodeURIComponent(bookTitle);
            const response = await fetch(`http://localhost:11304/api/book/chapter/${encodedBookTitle}/1`);
            if (response.ok) {
                const data = await response.json();
                bookExists = true;
                totalChapters = data.total_chapters || 61;
            } else {
                // 책이 존재하지 않으면 원문 참조 패널 숨기기
                if (referencePanel) {
                    referencePanel.style.display = 'none';
                }
                return;
            }
        } catch (error) {
            console.error('총 챕터 수 가져오기 실패:', error);
            // 오류 발생 시 원문 참조 패널 숨기기
            if (referencePanel) {
                referencePanel.style.display = 'none';
            }
            return;
        }
    }
    
    // 책이 존재하면 원문 참조 패널 표시
    if (referencePanel) {
        referencePanel.style.display = 'block';
    }
    
    // 레벨별 챕터 범위 계산
    const chapterRange = getChaptersForLevel(level, totalChapters);
    
    // 챕터 선택 드롭다운 업데이트 (레벨에 맞는 챕터만 표시)
    if (chapterSelect) {
        chapterSelect.innerHTML = '';
        for (let i = chapterRange.start; i <= chapterRange.end; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `Chapter ${i}`;
            chapterSelect.appendChild(option);
        }
    }
    
    // 레벨에 맞는 첫 번째 챕터 로드
    const firstChapter = chapterRange.start;
    await loadReferenceChapter(bookTitle, firstChapter, level);
    
    // 레벨 전환 버튼 숨기기 (해당 레벨만 보이므로 전환 불필요)
    if (referenceLevelToggle) {
        referenceLevelToggle.style.display = 'none';
    }
    
    // 챕터 선택 이벤트 리스너 제거 후 재추가 (중복 방지)
    if (chapterSelect) {
        // 기존 리스너 제거를 위해 클론 후 교체
        const newChapterSelect = chapterSelect.cloneNode(true);
        chapterSelect.parentNode.replaceChild(newChapterSelect, chapterSelect);
        
        // 새 리스너 추가
        newChapterSelect.addEventListener('change', async function() {
            const selectedChapter = parseInt(this.value);
            if (currentReferenceBook) {
                await loadReferenceChapter(currentReferenceBook, selectedChapter, currentReferenceLevel);
            }
        });
    }
}

// 원문 참조 패널에 챕터 로드 함수
async function loadReferenceChapter(bookTitle, chapterNumber, level) {
    const referencePassage = document.getElementById('reference-passage');
    const referenceLevelContents = document.querySelectorAll('.reference-level-content');
    const referenceChapterContent = document.getElementById('reference-chapter-content');
    
    if (!referencePassage) return;
    
    // 로딩 상태 표시
    referencePassage.innerHTML = '<p class="reference-text">챕터를 불러오는 중...</p>';
    
    try {
        let textContent = null;
        let data = null;
        
        // The Great Gatsby는 JSON 파일에서 로드
        if (bookTitle === 'The Great Gatsby' || bookTitle.includes('Gatsby')) {
            const jsonUrl = window.location.origin + '/data/The_Great_Gatsby_chapters.json';
            const jsonResponse = await fetch(jsonUrl);
            
            if (!jsonResponse.ok) {
                throw new Error(`JSON 파일을 불러올 수 없습니다. (HTTP ${jsonResponse.status})`);
            }
            
            const jsonData = await jsonResponse.json();
            const chapter = jsonData.chapters.find(ch => ch.chapter_number === chapterNumber);
            
            if (!chapter) {
                throw new Error(`챕터 ${chapterNumber}를 찾을 수 없습니다.`);
            }
            
            textContent = chapter.content;
            data = {
                text_content: chapter.content,
                chapter_number: chapter.chapter_number,
                book_title: jsonData.book_title,
                author: jsonData.author
            };
        } else {
            // 다른 책들은 MongoDB에서 로드
            const encodedBookTitle = encodeURIComponent(bookTitle);
            const response = await fetch(`http://localhost:11304/api/book/chapter/${encodedBookTitle}/${chapterNumber}`);
            
            if (!response.ok) {
                throw new Error(`HTTP 오류: ${response.status}`);
            }
            
            data = await response.json();
            
            if (!data.text_content && !data.textContent) {
                throw new Error('챕터 내용이 없습니다.');
            }
            
            textContent = data.textContent || data.text_content;
        }
        
        // 단어 단위로 분리하여 표시 (viewer.js와 동일한 방식)
        const words = textContent.split(/\s+/);
        const textContentHtml = words.map(word => 
            `<span class="word">${escapeHtml(word)}</span>`
        ).join(' ');
        
        // 번역 버튼과 토글 영역 HTML 생성
        const translationButton = `
            <button 
                id="reference-translate-btn" 
                class="reference-translate-btn" 
                data-book-title="${escapeHtml(bookTitle)}"
                data-chapter-num="${chapterNumber}"
                style="padding: 6px 12px; background: #4a90e2; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.3s ease; display: flex; align-items: center; gap: 6px; margin-left: auto;"
                title="한국어 번역 보기"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 8l6 6"></path>
                    <path d="M4 14l6-6 2-3"></path>
                    <path d="M2 5h12"></path>
                    <path d="M7 2h1"></path>
                    <path d="M22 22l-5-10-5 10"></path>
                    <path d="M14 18h6"></path>
                </svg>
                <span>한국어 번역</span>
            </button>
        `;
        
        const viewToggleSection = `
            <div id="reference-view-toggle" style="display: none; margin-bottom: 12px; text-align: center;">
                <button 
                    id="reference-show-original-btn" 
                    class="reference-view-toggle-btn active"
                    style="padding: 6px 16px; background: #4a90e2; color: white; border: none; border-radius: 6px 0 0 6px; cursor: pointer; font-size: 13px;"
                >
                    원문
                </button>
                <button 
                    id="reference-show-translation-btn" 
                    class="reference-view-toggle-btn"
                    style="padding: 6px 16px; background: #e0e0e0; color: #666; border: none; border-radius: 0 6px 6px 0; cursor: pointer; font-size: 13px; margin-left: -1px;"
                >
                    번역
                </button>
            </div>
        `;
        
        const translationSection = `
            <div id="reference-translation-section" style="display: none; margin-top: 12px; padding: 16px; background: #f9f9f9; border-radius: 8px; border: 1px solid #e0e0e0; width: 100%; max-width: 100%; box-sizing: border-box; overflow: visible;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h5 style="margin: 0; color: #333; font-size: 14px;">📖 한국어 번역</h5>
                    <button 
                        id="reference-close-translation-btn" 
                        style="background: transparent; border: none; cursor: pointer; padding: 4px; color: #666; font-size: 16px;"
                        title="번역 닫기"
                    >
                        ×
                    </button>
                </div>
                <div id="reference-translation-content" style="line-height: 1.8; color: #333; font-size: 14px; width: 100%; max-width: 100%; word-wrap: break-word; overflow-wrap: break-word; overflow: visible; box-sizing: border-box;">
                    <p style="text-align: center; color: #666;">번역 중...</p>
                </div>
            </div>
        `;
        
        // 기본 패널 콘텐츠 업데이트
        referencePassage.innerHTML = `<div class="reference-chapter-text">${textContentHtml}</div>`;
        
        // 확장 패널의 해당 레벨 콘텐츠 업데이트
        referenceLevelContents.forEach(content => {
            const contentLevel = content.dataset.level;
            if (contentLevel === level) {
                content.classList.add('active');
                content.style.display = 'block';
                // 번역 버튼, 토글, 번역 영역 포함하여 업데이트
                content.innerHTML = `
                    ${viewToggleSection}
                    <div id="reference-original-text" class="reference-chapter-text" style="width: 100%; max-width: 100%; word-wrap: break-word; overflow-wrap: break-word; overflow: visible; box-sizing: border-box;">${textContentHtml}</div>
                    ${translationSection}
                `;
            } else {
                content.classList.remove('active');
                content.style.display = 'none';
            }
        });
        
        // 원문 참조 패널 헤더에 번역 버튼 추가
        const referenceChapterHeader = document.querySelector('.reference-chapter-header');
        if (referenceChapterHeader) {
            // 기존 번역 버튼이 있으면 제거
            const existingTranslateBtn = document.getElementById('reference-translate-btn');
            if (existingTranslateBtn) {
                existingTranslateBtn.remove();
            }
            // 번역 버튼 추가
            const translateBtnWrapper = document.createElement('div');
            translateBtnWrapper.innerHTML = translationButton;
            const newTranslateBtn = translateBtnWrapper.firstElementChild;
            referenceChapterHeader.appendChild(newTranslateBtn);
            
            // 번역 버튼에 직접 이벤트 리스너 연결
            newTranslateBtn.addEventListener('click', async function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('번역 버튼 클릭됨:', bookTitle, chapterNumber);
                
                // 현재 활성화된 레벨 콘텐츠에서 텍스트 가져오기
                const activeContent = document.querySelector('.reference-level-content.active');
                let currentTextContent = textContent;
                
                if (activeContent) {
                    const originalTextDiv = activeContent.querySelector('#reference-original-text');
                    if (originalTextDiv) {
                        // 단어 span에서 텍스트 추출
                        const wordSpans = originalTextDiv.querySelectorAll('.word');
                        if (wordSpans.length > 0) {
                            currentTextContent = Array.from(wordSpans).map(span => span.textContent).join(' ');
                            console.log('텍스트 추출됨 (단어 span):', currentTextContent.substring(0, 100));
                        } else {
                            // word span이 없으면 직접 텍스트 가져오기
                            currentTextContent = originalTextDiv.textContent || originalTextDiv.innerText || textContent;
                            console.log('텍스트 추출됨 (직접):', currentTextContent.substring(0, 100));
                        }
                    } else {
                        // reference-original-text가 없으면 전체 텍스트 가져오기
                        currentTextContent = activeContent.textContent || activeContent.innerText || textContent;
                        console.log('텍스트 추출됨 (전체):', currentTextContent.substring(0, 100));
                    }
                }
                
                if (!currentTextContent || currentTextContent.trim().length === 0) {
                    alert('번역할 텍스트를 찾을 수 없습니다.');
                    console.error('텍스트를 찾을 수 없음');
                    return;
                }
                
                await translateReferenceChapter(bookTitle, chapterNumber, currentTextContent);
            });
        }
        
        // 단어 클릭 및 토글 버튼 이벤트 리스너 통합 (이벤트 위임 사용)
        const referenceViewer = document.getElementById('reference-viewer');
        if (referenceViewer) {
            // 기존 리스너 제거를 위해 새로 추가
            const newReferenceViewer = referenceViewer.cloneNode(true);
            referenceViewer.parentNode.replaceChild(newReferenceViewer, referenceViewer);
            
            newReferenceViewer.addEventListener('click', async function(e) {
                // 원문/번역 토글 버튼 클릭 처리
                const showOriginalBtn = e.target.closest('#reference-show-original-btn');
                const showTranslationBtn = e.target.closest('#reference-show-translation-btn');
                const closeTranslationBtn = e.target.closest('#reference-close-translation-btn');
                
                if (showOriginalBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 현재 활성화된 레벨 콘텐츠에서 요소 찾기
                    const activeContent = document.querySelector('.reference-level-content.active');
                    if (activeContent) {
                        const originalText = activeContent.querySelector('#reference-original-text');
                        const translationSection = activeContent.querySelector('#reference-translation-section');
                        
                        if (originalText) originalText.style.display = 'block';
                        if (translationSection) translationSection.style.display = 'none';
                        
                        showOriginalBtn.style.background = '#4a90e2';
                        showOriginalBtn.style.color = 'white';
                        
                        const translationBtn = activeContent.querySelector('#reference-show-translation-btn');
                        if (translationBtn) {
                            translationBtn.style.background = '#e0e0e0';
                            translationBtn.style.color = '#666';
                        }
                    }
                    return;
                }
                
                if (showTranslationBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 현재 활성화된 레벨 콘텐츠에서 요소 찾기
                    const activeContent = document.querySelector('.reference-level-content.active');
                    if (activeContent) {
                        const originalText = activeContent.querySelector('#reference-original-text');
                        const translationSection = activeContent.querySelector('#reference-translation-section');
                        
                        if (originalText) originalText.style.display = 'none';
                        if (translationSection) translationSection.style.display = 'block';
                        
                        showTranslationBtn.style.background = '#4a90e2';
                        showTranslationBtn.style.color = 'white';
                        
                        const originalBtn = activeContent.querySelector('#reference-show-original-btn');
                        if (originalBtn) {
                            originalBtn.style.background = '#e0e0e0';
                            originalBtn.style.color = '#666';
                        }
                    }
                    return;
                }
                
                if (closeTranslationBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 현재 활성화된 레벨 콘텐츠에서 요소 찾기
                    const activeContent = document.querySelector('.reference-level-content.active');
                    if (activeContent) {
                        const translationSection = activeContent.querySelector('#reference-translation-section');
                        const viewToggle = activeContent.querySelector('#reference-view-toggle');
                        const originalText = activeContent.querySelector('#reference-original-text');
                        
                        if (translationSection) translationSection.style.display = 'none';
                        if (viewToggle) viewToggle.style.display = 'none';
                        if (originalText) originalText.style.display = 'block';
                        
                        // 원문 버튼 활성화
                        const originalBtn = activeContent.querySelector('#reference-show-original-btn');
                        if (originalBtn) {
                            originalBtn.style.background = '#4a90e2';
                            originalBtn.style.color = 'white';
                        }
                        
                        // 번역 버튼 비활성화
                        const translationBtn = activeContent.querySelector('#reference-show-translation-btn');
                        if (translationBtn) {
                            translationBtn.style.background = '#e0e0e0';
                            translationBtn.style.color = '#666';
                        }
                    }
                    return;
                }
                
                // 단어 클릭 이벤트 처리
                if (e.target.tagName === 'SPAN' && e.target.classList.contains('word')) {
                    let clickedWord = e.target.textContent.trim();
                    if (!clickedWord) return;
                    
                    // 구두점 제거 및 소문자 변환
                    clickedWord = clickedWord.replace(/[.,!?;:"'"]/g, '').toLowerCase();
                    
                    try {
                        // 백엔드 AI API 호출
                        const response = await fetch('http://127.0.0.1:11304/api/ai/lookup', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                word: clickedWord
                            })
                        });
                        
                        if (!response.ok) {
                            throw new Error('AI API 요청 실패 또는 서버 오류 발생');
                        }
                        
                        const data = await response.json();
                        
                        // 툴팁 표시 (viewer.js의 함수 사용)
                        if (typeof showWordTooltipWithData === 'function') {
                            showWordTooltipWithData(e.target, data);
                        } else {
                            // viewer.js의 함수가 없으면 직접 표시
                            alert(`단어: ${data.word} (${data.pronunciation || '발음 정보 없음'})\n뜻: ${data.meaning}\n예문: ${data.example}`);
                        }
                    } catch (error) {
                        console.error("AI 뜻 검색 실패:", error);
                        if (typeof showErrorTooltip === 'function') {
                            showErrorTooltip(e.target, error.message);
                        } else {
                            alert(`단어 검색 중 오류가 발생했습니다: ${error.message}`);
                        }
                    }
                }
            });
        }
        
    } catch (error) {
        console.error('챕터 로드 오류:', error);
        referencePassage.innerHTML = `
            <p class="reference-text" style="color: #ff6b6b;">
                ⚠️ 챕터를 불러올 수 없습니다: ${escapeHtml(error.message)}
            </p>
        `;
    }
}

// 원문 참조 패널 챕터 번역 함수
async function translateReferenceChapter(bookTitle, chapterNumber, textContent) {
    console.log('translateReferenceChapter 호출됨:', { bookTitle, chapterNumber, textLength: textContent?.length });
    
    // 현재 활성화된 레벨 콘텐츠에서 번역 영역 찾기
    const activeContent = document.querySelector('.reference-level-content.active');
    if (!activeContent) {
        console.error('❌ 활성화된 레벨 콘텐츠를 찾을 수 없습니다.');
        alert('번역 영역을 찾을 수 없습니다. 챕터를 다시 로드해주세요.');
        return;
    }
    
    const translationContent = activeContent.querySelector('#reference-translation-content');
    const translationSection = activeContent.querySelector('#reference-translation-section');
    const viewToggle = activeContent.querySelector('#reference-view-toggle');
    
    if (!translationContent || !translationSection) {
        console.error('❌ 번역 영역을 찾을 수 없습니다.', { translationContent, translationSection });
        alert('번역 영역을 찾을 수 없습니다. 페이지를 새로고침해주세요.');
        return;
    }
    
    // 번역 영역 표시
    translationSection.style.display = 'block';
    if (viewToggle) viewToggle.style.display = 'block';
    
    // 로딩 상태 표시
    translationContent.innerHTML = '<p style="text-align: center; color: #666;">번역 중입니다. 잠시만 기다려주세요...</p>';
    
    try {
        // fetchTranslation 함수 사용 (EN -> KO) - AI 뷰어와 동일한 방식
        let translatedText;
        
        if (typeof window.fetchTranslation === 'function') {
            console.log('window.fetchTranslation 사용');
            translatedText = await window.fetchTranslation(textContent, 'ko');
        } else {
            console.log('직접 API 호출');
            // 직접 API 호출 - AI 뷰어와 동일한 형식 사용
            const response = await fetch('http://127.0.0.1:11304/api/translate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    text: textContent,
                    source_lang: 'EN',
                    target_lang: 'KO'
                })
            });
            
            if (!response.ok) {
                throw new Error(`서버 오류: ${response.status}`);
            }
            
            const data = await response.json();
            // AI 뷰어와 동일한 응답 형식 확인
            if (data.success && data.translatedText) {
                translatedText = data.translatedText;
            } else {
                throw new Error(data.message || '번역 결과를 받을 수 없습니다.');
            }
            console.log('번역 결과 받음:', translatedText?.substring(0, 100));
        }
        
        if (!translatedText) {
            throw new Error('번역 결과를 받을 수 없습니다.');
        }
        
        // 번역 결과를 문단 단위로 분리하여 표시 (AI 뷰어와 동일한 방식)
        const paragraphs = translatedText.split(/\n\n+/).filter(p => p.trim());
        const translationHtml = paragraphs.map(para => {
            const trimmedPara = para.trim();
            if (!trimmedPara) return '';
            return `<p style="margin: 0 0 12px 0; line-height: 1.8; width: 100%; max-width: 100%; word-wrap: break-word; overflow-wrap: break-word; box-sizing: border-box;">${escapeHtml(trimmedPara)}</p>`;
        }).join('');
        
        translationContent.innerHTML = translationHtml || `<p style="white-space: pre-wrap; line-height: 1.8; width: 100%; max-width: 100%; word-wrap: break-word; overflow-wrap: break-word; box-sizing: border-box;">${escapeHtml(translatedText)}</p>`;
        console.log('번역 완료');
        
        // 번역 완료 후 자동으로 번역 뷰로 전환
        const originalText = activeContent.querySelector('#reference-original-text');
        const showOriginalBtn = activeContent.querySelector('#reference-show-original-btn');
        const showTranslationBtn = activeContent.querySelector('#reference-show-translation-btn');
        
        if (originalText && translationSection) {
            // 원문 숨기고 번역 표시
            originalText.style.display = 'none';
            translationSection.style.display = 'block';
            
            // 토글 버튼 상태 업데이트
            if (showOriginalBtn && showTranslationBtn) {
                showOriginalBtn.style.background = '#e0e0e0';
                showOriginalBtn.style.color = '#666';
                showTranslationBtn.style.background = '#4a90e2';
                showTranslationBtn.style.color = 'white';
            }
        }
        
    } catch (error) {
        console.error('❌ 번역 오류:', error);
        // AI 뷰어와 동일한 에러 메시지 형식 사용
        translationContent.innerHTML = `
            <p style="text-align: center; color: #ff6b6b;">
                ⚠️ 번역 중 오류가 발생했습니다: ${escapeHtml(error.message)}
            </p>
        `;
    }
}

// 챕터 내용 로드 함수 (하위 호환성을 위해 유지, 실제로는 loadReferenceChapter 사용)
async function loadChapterContent(chapterNumber, level) {
    if (currentReferenceBook) {
        await loadReferenceChapter(currentReferenceBook, chapterNumber, level);
    }
}

function getDummyCorrection(text) {
    return {
        original: text,
        revised: text
            .replace(/\s+/g, ' ')
            .replace(/\bi\b/g, 'I')
            .replace(/\.{2,}/g, '.')
            .trim() + (/[.!?]$/.test(text.trim()) ? '' : '.')
    };
}

// AI 교정 함수
async function getAICorrection(text) {
    try {
        const model = createGeminiModel();
        if (!model) {
            // 모델을 사용할 수 없으면 기본 교정 사용
            return getDummyCorrection(text);
        }

        const prompt = `다음 한국어 문장을 교정해주세요. 문법 오류를 수정하고 자연스러운 표현으로 개선해주세요. 교정된 문장만 답변해주세요.

원문: ${text}`;

        // generateContent 호출 (안전한 형식 사용)
        // 최신 SDK에서는 문자열 직접 전달 또는 객체 형식 모두 지원
        let result;
        try {
            // 먼저 문자열 직접 전달 시도
            result = await model.generateContent(prompt);
        } catch (stringError) {
            console.warn('문자열 직접 전달 실패, 객체 형식으로 재시도:', stringError.message);
            // 객체 형식으로 재시도
            result = await model.generateContent({
                contents: [{
                    role: 'user',
                    parts: [{ text: prompt }],
                }],
            });
        }

        if (!result || !result.response) {
            return getDummyCorrection(text);
        }

        // 최신 SDK에서는 response.text()가 함수이거나 직접 속성일 수 있음
        const revised = (typeof result.response.text === 'function' 
            ? result.response.text() 
            : (result.response.text || result.response.candidates?.[0]?.content?.parts?.[0]?.text || '')).trim();
        return {
            original: text,
            revised: revised
        };
    } catch (error) {
        console.error('AI 교정 오류:', error);
        return getDummyCorrection(text);
    }
}

// DeepL API를 사용한 번역 함수 (백엔드 서버를 통해 호출)
async function getTranslationToEnglishWithDeepL(text) {
    try {
        if (!text || !text.trim()) {
            return '번역할 텍스트가 없습니다.';
        }

        // 백엔드 서버의 번역 엔드포인트 호출
        const response = await fetch('http://127.0.0.1:11304/api/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // 세션 쿠키를 포함
            body: JSON.stringify({
                text: text,
                source_lang: 'KO',
                target_lang: 'EN'
            })
        });

        if (!response.ok) {
            throw new Error(`서버 오류: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success && data.translatedText) {
            return data.translatedText;
        } else {
            throw new Error(data.message || '번역 결과를 받을 수 없습니다.');
        }
    } catch (error) {
        console.error('DeepL 번역 오류:', error);
        // 오류 발생 시 기존 Gemini 번역으로 폴백
        return await getTranslationToEnglishWithGemini(text);
    }
}

// Gemini를 사용한 번역 함수 (기존 로직)
async function getTranslationToEnglishWithGemini(text) {
    try {
        // 빈 텍스트 체크
        if (!text || !text.trim()) {
            return '번역할 텍스트가 없습니다.';
        }

        const model = createGeminiModel();
        if (!model) {
            console.warn('Gemini 모델을 생성할 수 없습니다.');
            return '번역 기능을 사용할 수 없습니다.';
        }

        const prompt = `다음 한국어 문장을 자연스러운 영어로 번역해주세요. 번역된 영어 문장만 답변해주세요. 추가 설명이나 다른 텍스트는 포함하지 마세요.

한국어: ${text}`;

        // generateContent 호출 (안전한 형식 사용)
        // 최신 SDK에서는 문자열 직접 전달 또는 객체 형식 모두 지원
        let result;
        try {
            // 먼저 문자열 직접 전달 시도
            result = await model.generateContent(prompt);
        } catch (stringError) {
            console.warn('문자열 직접 전달 실패, 객체 형식으로 재시도:', stringError.message);
            // 객체 형식으로 재시도
            result = await model.generateContent({
                contents: [{
                    role: 'user',
                    parts: [{ text: prompt }],
                }],
            });
        }

        if (!result) {
            console.warn('번역 결과가 없습니다.');
            return '번역 결과를 받을 수 없습니다.';
        }

        if (!result.response) {
            console.warn('번역 응답이 없습니다.');
            return '번역 응답을 받을 수 없습니다.';
        }

        // response.text()가 함수인지 확인
        if (typeof result.response.text !== 'function') {
            console.warn('응답 텍스트 함수가 없습니다:', result.response);
            // 다른 형식의 응답일 수 있으므로 시도
            if (result.response.candidates && result.response.candidates[0] && result.response.candidates[0].content) {
                const content = result.response.candidates[0].content;
                if (content.parts && content.parts[0] && content.parts[0].text) {
                    return content.parts[0].text.trim();
                }
            }
            return '번역을 생성할 수 없습니다.';
        }

        const translatedText = result.response.text().trim();
        
        // 빈 결과 체크
        if (!translatedText) {
            return '번역 결과가 비어있습니다.';
        }

        return translatedText;
    } catch (error) {
        console.error('번역 오류 상세:', error);
        // 오류 메시지에서 더 자세한 정보 제공
        if (error.message) {
            console.error('오류 메시지:', error.message);
        }
        return '번역 중 오류가 발생했습니다.';
    }
}

// 한국어를 영어로 번역하는 함수 (조건부 선택: DeepL 우선, 없으면 Gemini)
async function getTranslationToEnglish(text) {
    // DeepL API 키가 유효한지 확인
    if (typeof DEEPL_API_KEY !== 'undefined' && DEEPL_API_KEY && !DEEPL_API_KEY.includes('발급받은')) {
        // DeepL API 사용
        return await getTranslationToEnglishWithDeepL(text);
    } else {
        // 기존 Gemini 번역 사용
        return await getTranslationToEnglishWithGemini(text);
    }
}

// AI 교정 요청 함수 (서버의 /api/correct 엔드포인트 사용)
async function requestAiCorrection(text, targetLang = 'EN') {
    try {
        // 입력 검증
        if (!text || !text.trim()) {
            throw new Error('교정할 텍스트가 필요합니다.');
        }

        // 백엔드 서버의 교정 엔드포인트 호출
        const response = await fetch('http://127.0.0.1:11304/api/correct', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // 세션 쿠키를 포함
            body: JSON.stringify({
                englishText: text.trim(),
                targetLang: targetLang
            })
        });

        // 응답 상태 확인
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `서버 오류: ${response.status}`);
        }

        // 응답 데이터 파싱
        const data = await response.json();

        // 성공적인 응답 확인
        if (data.success && data.corrected) {
            return {
                original: data.original,
                corrected: data.corrected
            };
        } else {
            throw new Error(data.message || '교정 결과를 받을 수 없습니다.');
        }
    } catch (error) {
        console.error('requestAiCorrection 오류:', error);
        throw error; // 에러를 다시 throw하여 호출자가 처리할 수 있도록 함
    }
}

// 범용 번역 함수 (서버의 /api/translate 엔드포인트 사용)
// 전역 스코프에 노출 (viewer.js에서 사용)
window.fetchTranslation = async function fetchTranslation(text, targetLang) {
    try {
        // 입력 검증
        if (!text || !text.trim()) {
            throw new Error('번역할 텍스트가 필요합니다.');
        }

        if (!targetLang) {
            throw new Error('목표 언어가 필요합니다.');
        }

        // 언어 코드를 DeepL 형식으로 변환 (소문자 -> 대문자)
        const targetLangCode = targetLang.toUpperCase();

        // 소스 언어는 자동 감지 (DeepL API의 'auto' 사용)
        // 또는 기본값으로 영어에서 번역한다고 가정
        const sourceLangCode = 'EN'; // 필요에 따라 'auto'로 변경 가능

        // 백엔드 서버의 번역 엔드포인트 호출
        const response = await fetch('http://127.0.0.1:11304/api/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // 세션 쿠키를 포함
            body: JSON.stringify({
                text: text,
                source_lang: sourceLangCode,
                target_lang: targetLangCode
            })
        });

        // 응답 상태 확인
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `서버 오류: ${response.status}`);
        }

        // 응답 데이터 파싱
        const data = await response.json();

        // 성공적인 응답 확인
        if (data.success && data.translatedText) {
            return data.translatedText;
        } else {
            throw new Error(data.message || '번역 결과를 받을 수 없습니다.');
        }
    } catch (error) {
        console.error('fetchTranslation 오류:', error);
        throw error; // 에러를 다시 throw하여 호출자가 처리할 수 있도록 함
    }
}

// 현재 챕터의 전체 텍스트를 가져오는 함수
function getCurrentChapterText() {
    const viewer = document.getElementById('original-text-viewer');
    if (!viewer) {
        console.warn('⚠️ original-text-viewer 요소를 찾을 수 없습니다.');
        return '';
    }

    // viewer.js의 loadChapter가 생성한 .word 요소들에서 텍스트 수집
    // .chapter-text div 내부의 .word 요소도 포함하여 검색
    const wordElements = viewer.querySelectorAll('.word');
    
    // .chapter-text div 내부에서도 시도
    const chapterTextDiv = viewer.querySelector('.chapter-text');
    if (chapterTextDiv) {
        const wordsInChapterText = chapterTextDiv.querySelectorAll('.word');
        
        if (wordsInChapterText.length > 0) {
            // .word 요소들의 텍스트를 순서대로 가져와서 공백으로 연결
            const texts = Array.from(wordsInChapterText).map(el => el.textContent.trim());
            const result = texts.join(' ');
            return result;
        }
    }
    
    if (wordElements.length > 0) {
        // .word 요소가 있으면 (viewer.js로 로드된 경우)
        const texts = Array.from(wordElements).map(el => el.textContent.trim());
        const result = texts.join(' ');
        return result;
    }

    // 기존 방식: .viewer-level.active와 .viewer-text 구조 (하위 호환성)
    const activeLevel = document.querySelector('.viewer-level.active');
    if (!activeLevel) {
        return '';
    }

    const textElements = activeLevel.querySelectorAll('.viewer-text');
    const texts = Array.from(textElements).map(el => el.textContent.trim()).filter(text => text.length > 0);
    
    return texts.join(' ');
}

// 줄거리 요약 함수 (버튼 클릭 시 호출)
async function fetchSummary() {
    const summaryResult = document.getElementById('summary-result');
    const summaryPlaceholder = document.getElementById('summary-placeholder');
    
    if (!summaryResult) {
        console.error('요약 결과 표시 영역을 찾을 수 없습니다.');
        return;
    }

    // 현재 챕터 텍스트 가져오기
    const chapterText = getCurrentChapterText();
    
    if (!chapterText || !chapterText.trim()) {
        console.error('❌ 챕터 텍스트를 가져올 수 없습니다.');
        summaryResult.innerHTML = '<p style="color: #ff6b6b;">⚠️ 챕터 텍스트를 가져올 수 없습니다. 챕터를 선택했는지 확인해주세요.</p>';
        summaryResult.style.display = 'block';
        if (summaryPlaceholder) summaryPlaceholder.style.display = 'none';
        return;
    }

    // 로딩 상태 표시
    summaryResult.innerHTML = '<p>📝 AI가 챕터 요약을 생성하는 중...</p>';
    summaryResult.style.display = 'block';
    if (summaryPlaceholder) summaryPlaceholder.style.display = 'none';

    try {
        // 서버의 /api/summarize 엔드포인트 호출
        const response = await fetch('http://127.0.0.1:11304/api/summarize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // 세션 쿠키를 포함
            body: JSON.stringify({
                chapterText: chapterText
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `서버 오류: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.summary) {
            // 요약 결과 표시
            summaryResult.innerHTML = `
                <h5>📚 챕터 요약</h5>
                <div class="summary-content">
                    <p>${escapeHtml(data.summary).replace(/\n/g, '<br>')}</p>
                </div>
            `;
        } else {
            throw new Error('요약 결과를 받을 수 없습니다.');
        }
    } catch (error) {
        console.error('줄거리 요약 오류:', error);
        summaryResult.innerHTML = `<p style="color: #ff6b6b;">❌ 요약 생성 중 오류가 발생했습니다: ${escapeHtml(error.message)}</p>`;
    }
}

// 토론 주제 생성 처리 함수
async function handleDiscussionTopics() {
    const topicsResult = document.getElementById('topics-result');
    const topicsPlaceholder = document.getElementById('topics-placeholder');
    
    if (!topicsResult) {
        console.error('토론 주제 결과 표시 영역을 찾을 수 없습니다.');
        return;
    }

    // 현재 챕터 텍스트 가져오기
    const chapterText = getCurrentChapterText();
    
    if (!chapterText || !chapterText.trim()) {
        console.error('❌ 챕터 텍스트를 가져올 수 없습니다.');
        topicsResult.innerHTML = '<p style="color: #ff6b6b;">⚠️ 챕터 텍스트를 가져올 수 없습니다. 챕터를 선택했는지 확인해주세요.</p>';
        topicsResult.style.display = 'block';
        if (topicsPlaceholder) topicsPlaceholder.style.display = 'none';
        return;
    }

    // 로딩 상태 표시
    topicsResult.innerHTML = '<p>💭 AI가 토론 주제를 생성하는 중...</p>';
    topicsResult.style.display = 'block';
    if (topicsPlaceholder) topicsPlaceholder.style.display = 'none';

    try {
        // 서버의 /api/topics 엔드포인트 호출
        const response = await fetch('http://127.0.0.1:11304/api/topics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // 세션 쿠키를 포함
            body: JSON.stringify({
                chapterText: chapterText
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `서버 오류: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.topics) {
            // 토론 주제 텍스트 정리 및 파싱
            const topicsText = data.topics;
            
            // 문자열 정리 함수
            function cleanTopicText(text) {
                // 1. 줄바꿈으로 분리
                let lines = text.split(/\n+/).map(line => line.trim()).filter(line => line.length > 0);
                
                // 2. 설명 문장 제거 (Gemini의 추가 설명 제거)
                lines = lines.filter(line => {
                    const lowerLine = line.toLowerCase();
                    // 설명 문장 패턴 제거
                    if (lowerLine.includes('제공된 챕터') || 
                        lowerLine.includes('챕터 텍스트') ||
                        lowerLine.includes('기반으로') ||
                        lowerLine.includes('생성') ||
                        lowerLine.includes('다음은') ||
                        lowerLine.includes('토론 주제') ||
                        lowerLine.includes('질문은') ||
                        (lowerLine.startsWith('**') && lowerLine.endsWith('**')) ||
                        line.match(/^[가-힣\s]*:$/) || // "다음과 같습니다:" 같은 패턴
                        line.length < 10) { // 너무 짧은 줄 제거 (설명일 가능성)
                        return false;
                    }
                    return true;
                });
                
                // 3. 각 줄에서 번호 기호 제거 (1., 2., 3., - , •, *, 등)
                lines = lines.map(line => {
                    // 다양한 번호 패턴 제거
                    let cleaned = line
                        .replace(/^[\d]+\.\s*/, '') // 1. 2. 3.
                        .replace(/^[\d]+\)\s*/, '') // 1) 2) 3)
                        .replace(/^[-\-\•\*]\s*/, '') // -, •, *
                        .replace(/^\[[\d]+\]\s*/, '') // [1] [2] [3]
                        .replace(/^\([\d]+\)\s*/, '') // (1) (2) (3)
                        .trim();
                    
                    // 앞뒤 따옴표 제거
                    cleaned = cleaned.replace(/^["'`]|["'`]$/g, '');
                    
                    return cleaned;
                })
                .filter(line => line.length > 0 && line.length > 10); // 빈 줄과 너무 짧은 줄 제거
                
                // 4. 질문 형식인지 확인 (물음표 포함 또는 질문어 포함)
                lines = lines.filter(line => {
                    const hasQuestionMark = line.includes('?') || line.includes('？');
                    const hasQuestionWord = /^(왜|어떻게|무엇|어디|언제|누구|어떤|어느)/.test(line);
                    return hasQuestionMark || hasQuestionWord || line.length > 15;
                });
                
                // 5. 정확히 3개만 추출
                return lines.slice(0, 3);
            }
            
            // 토론 주제 정리
            const cleanedTopics = cleanTopicText(topicsText);
            
            if (cleanedTopics.length === 0) {
                throw new Error('토론 주제를 파싱할 수 없습니다.');
            }
            
            // HTML 리스트로 변환
            const formattedTopics = cleanedTopics
                .map(topic => `<li>${escapeHtml(topic)}</li>`)
                .join('');

            topicsResult.innerHTML = `
                <h5>💬 AI 토론 주제</h5>
                <ol class="topics-list">
                    ${formattedTopics}
                </ol>
            `;
        } else {
            throw new Error('토론 주제를 받을 수 없습니다.');
        }
    } catch (error) {
        console.error('토론 주제 생성 오류:', error);
        topicsResult.innerHTML = `<p style="color: #ff6b6b;">❌ 토론 주제 생성 중 오류가 발생했습니다: ${escapeHtml(error.message)}</p>`;
    }
}

// AI 뷰어에서 텍스트 클릭 시 번역 처리 함수
async function handleTextTranslation(text, clickedElement) {
    const translationDisplay = document.getElementById('translation-display');
    const translationText = translationDisplay?.querySelector('.translation-text');
    
    if (!translationDisplay || !translationText) {
        console.error('번역 표시 영역을 찾을 수 없습니다.');
        return;
    }

    // 번역 표시 영역 표시
    translationDisplay.style.display = 'block';
    
    // 로딩 상태 표시
    translationText.textContent = '번역 중...';
    translationText.style.color = '#666';
    
    // 클릭된 요소에 하이라이트 효과
    clickedElement.style.backgroundColor = 'rgba(245, 230, 179, 0.3)';
    
    try {
        // fetchTranslation 함수 호출 (영어 -> 한국어)
        const translatedText = await fetchTranslation(text, 'ko');
        
        // 번역 결과 표시
        translationText.textContent = translatedText;
        translationText.style.color = '#000';
        
        // 3초 후 하이라이트 제거
        setTimeout(() => {
            clickedElement.style.backgroundColor = '';
        }, 3000);
        
    } catch (error) {
        console.error('번역 처리 오류:', error);
        
        // 에러 메시지 표시
        translationText.textContent = '번역 중 오류가 발생했습니다. 서버가 실행 중인지 확인해주세요.';
        translationText.style.color = '#d32f2f';
        
        // 하이라이트 제거
        clickedElement.style.backgroundColor = '';
    }
}

// 플레이리스트 기능
document.addEventListener('DOMContentLoaded', function() {
    const playPauseBtn = document.getElementById('play-pause-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const playIcon = playPauseBtn?.querySelector('.play-icon');
    const pauseIcon = playPauseBtn?.querySelector('.pause-icon');
    const songTitle = document.querySelector('.song-title');
    const artistName = document.querySelector('.artist-name');
    
    let isPlaying = false;
    
    // 샘플 플레이리스트 데이터
    const playlist = [
        { title: 'Classical Reading Playlist', artist: 'Various Artists' },
        { title: 'Moonlight Sonata', artist: 'Ludwig van Beethoven' },
        { title: 'Clair de Lune', artist: 'Claude Debussy' },
        { title: 'Gymnopédie No. 1', artist: 'Erik Satie' },
        { title: 'The Four Seasons - Spring', artist: 'Antonio Vivaldi' }
    ];
    
    let currentTrackIndex = 0;
    
    // 재생/일시정지 버튼 클릭 이벤트
    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', function() {
            isPlaying = !isPlaying;
            
            // 헤더 버튼 상태 업데이트
            updateHeaderPlayPauseState(isPlaying);
            
            // 현재 재생 중인 음악 카드의 재생 버튼 상태도 업데이트
            if (currentPlayingMusicId) {
                const currentMusicCard = document.querySelector(`.music-card[data-music-id="${currentPlayingMusicId}"]`);
                if (currentMusicCard) {
                    const playBtn = currentMusicCard.querySelector('.music-play-btn');
                    if (playBtn) {
                        if (isPlaying) {
                            playBtn.classList.add('playing');
                            const icon = playBtn.querySelector('svg');
                            if (icon) {
                                icon.innerHTML = '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>';
                            }
                        } else {
                            playBtn.classList.remove('playing');
                            const icon = playBtn.querySelector('svg');
                            if (icon) {
                                icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
                            }
                        }
                    }
                }
            }
            
            // 현재 재생 중인 플레이리스트의 재생 버튼 상태도 업데이트
            if (currentPlayingPlaylistId) {
                const currentPlaylistCard = document.querySelector(`.public-playlist-card[data-playlist-id="${currentPlayingPlaylistId}"]`);
                if (currentPlaylistCard) {
                    const playBtn = currentPlaylistCard.querySelector('.playlist-play-btn');
                    if (playBtn) {
                        if (isPlaying) {
                            playBtn.classList.add('playing');
                            const icon = playBtn.querySelector('svg');
                            if (icon) {
                                icon.innerHTML = '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>';
                            }
                        } else {
                            playBtn.classList.remove('playing');
                            const icon = playBtn.querySelector('svg');
                            if (icon) {
                                icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
                            }
                        }
                    }
                }
            }
        });
    }
    
    // 이전 곡 버튼 클릭 이벤트
    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            currentTrackIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
            const currentTrack = playlist[currentTrackIndex];
            
            if (songTitle) songTitle.textContent = currentTrack.title;
            if (artistName) artistName.textContent = currentTrack.artist;
        });
    }
    
    // 다음 곡 버튼 클릭 이벤트
    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
            const currentTrack = playlist[currentTrackIndex];
            
            if (songTitle) songTitle.textContent = currentTrack.title;
            if (artistName) artistName.textContent = currentTrack.artist;
        });
    }
    
    // 지도 페이지 기능
    const mapSearchInput = document.getElementById('map-search-input');
    const mapSearchBtn = document.querySelector('.map-search-btn');
    const nearbyPlacesBtn = document.getElementById('nearby-places-btn');
    const bookPlacesBtn = document.getElementById('book-places-btn');
    
    // 지도 검색 기능
    if (mapSearchBtn && mapSearchInput) {
        mapSearchBtn.addEventListener('click', function() {
            const searchTerm = mapSearchInput.value.trim();
            if (searchTerm) {
                // TODO: Google Maps API 연동 시 여기에 검색 로직 추가
            }
        });
        
        mapSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                mapSearchBtn.click();
            }
        });
    }
    
    // 주변 장소 추천 버튼
    if (nearbyPlacesBtn) {
        nearbyPlacesBtn.addEventListener('click', function() {
            searchNearbyReadingPlaces();
        });
    }
    
    // 책 속 장소 찾기 버튼
    if (bookPlacesBtn) {
        bookPlacesBtn.addEventListener('click', function() {
            showBookPlacesModal();
        });
    }
    
    // 장소 저장 기능
    const savePlaceBtn = document.getElementById('save-place-btn');
    const savePlaceModal = document.getElementById('save-place-modal');
    const savePlaceModalClose = document.getElementById('save-place-modal-close');
    const savePlaceCancelBtn = document.getElementById('save-place-cancel-btn');
    const savePlaceSubmitBtn = document.getElementById('save-place-submit-btn');
    const savePlaceNameInput = document.getElementById('save-place-name');
    const savePlaceAddressInput = document.getElementById('save-place-address');
    const savePlaceDescriptionInput = document.getElementById('save-place-description');
    
    // 장소 저장 모달 열기
    function openSavePlaceModal() {
        if (savePlaceModal) {
            savePlaceModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            if (savePlaceNameInput) savePlaceNameInput.focus();
        }
    }
    
    // 장소 저장 모달 닫기
    function closeSavePlaceModal() {
        if (savePlaceModal) {
            savePlaceModal.classList.remove('active');
            document.body.style.overflow = '';
            // 입력 필드 초기화
            if (savePlaceNameInput) savePlaceNameInput.value = '';
            if (savePlaceAddressInput) savePlaceAddressInput.value = '';
            if (savePlaceDescriptionInput) savePlaceDescriptionInput.value = '';
            // 공개 설정 초기화
            const publicRadio = document.querySelector('input[name="save-place-visibility"][value="public"]');
            if (publicRadio) publicRadio.checked = true;
        }
    }
    
    // 장소 저장 버튼 클릭
    if (savePlaceBtn) {
        savePlaceBtn.addEventListener('click', openSavePlaceModal);
    }
    
    // 모달 닫기 버튼
    if (savePlaceModalClose) {
        savePlaceModalClose.addEventListener('click', closeSavePlaceModal);
    }
    
    if (savePlaceCancelBtn) {
        savePlaceCancelBtn.addEventListener('click', closeSavePlaceModal);
    }
    
    // 모달 배경 클릭 시 닫기
    if (savePlaceModal) {
        savePlaceModal.addEventListener('click', function(e) {
            if (e.target === savePlaceModal) {
                closeSavePlaceModal();
            }
        });
    }
    
    // 저장된 장소 목록 불러오기
    function loadSavedPlaces() {
        const savedPlaces = JSON.parse(localStorage.getItem('savedPlaces') || '[]');
        const savedPlacesList = document.getElementById('saved-places-list');
        if (!savedPlacesList) return;
        
        savedPlacesList.innerHTML = '';
        
        if (savedPlaces.length === 0) {
            savedPlacesList.innerHTML = '<p style="text-align: center; color: rgba(0,0,0,0.5); padding: 40px;">저장된 장소가 없습니다.</p>';
            return;
        }
        
        savedPlaces.forEach((place, index) => {
            const placeItem = document.createElement('article');
            placeItem.className = 'place-item';
            placeItem.setAttribute('data-place-id', place.id);
            placeItem.innerHTML = `
                <div class="place-info">
                    <h5 class="place-name">${escapeHtml(place.name)}</h5>
                    <p class="place-address">${escapeHtml(place.address)}</p>
                    ${place.description ? `<p class="place-description">${escapeHtml(place.description)}</p>` : ''}
                    <div class="place-meta">
                        <span class="place-visibility-badge ${place.isPublic ? 'public' : 'private'}">${place.isPublic ? '공개' : '비공개'}</span>
                    </div>
                </div>
                <div class="place-actions">
                    <button type="button" class="place-share-btn" data-place-id="${place.id}" aria-label="공유">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="18" cy="5" r="3"></circle>
                            <circle cx="6" cy="12" r="3"></circle>
                            <circle cx="18" cy="19" r="3"></circle>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                        <span>공유</span>
                    </button>
                    <button type="button" class="place-delete-btn" data-place-id="${place.id}" aria-label="삭제">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            `;
            savedPlacesList.appendChild(placeItem);
        });
        
        // 공유 버튼 이벤트 리스너
        const shareButtons = savedPlacesList.querySelectorAll('.place-share-btn');
        shareButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const placeId = this.getAttribute('data-place-id');
                sharePlace(placeId);
            });
        });
        
        // 삭제 버튼 이벤트 리스너
        const deleteButtons = savedPlacesList.querySelectorAll('.place-delete-btn');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const placeId = this.getAttribute('data-place-id');
                deletePlace(placeId);
            });
        });
    }
    
    // 장소 저장
    if (savePlaceSubmitBtn) {
        savePlaceSubmitBtn.addEventListener('click', function() {
            const name = savePlaceNameInput?.value.trim();
            const address = savePlaceAddressInput?.value.trim();
            const description = savePlaceDescriptionInput?.value.trim() || '';
            const visibilityRadio = document.querySelector('input[name="save-place-visibility"]:checked');
            const isPublic = visibilityRadio?.value === 'public';
            
            if (!name || !address) {
                return;
            }
            
            const savedPlaces = JSON.parse(localStorage.getItem('savedPlaces') || '[]');
            const newPlace = {
                id: Date.now().toString(),
                name: name,
                address: address,
                description: description,
                isPublic: isPublic,
                createdAt: new Date().toISOString()
            };
            
            savedPlaces.unshift(newPlace);
            localStorage.setItem('savedPlaces', JSON.stringify(savedPlaces));
            
            closeSavePlaceModal();
            loadSavedPlaces();
        });
    }
    
    // 장소 공유
    function sharePlace(placeId) {
        const savedPlaces = JSON.parse(localStorage.getItem('savedPlaces') || '[]');
        const place = savedPlaces.find(p => p.id === placeId);
        
        if (!place) {
            alert('장소를 찾을 수 없습니다.');
            return;
        }
        
        // 공유 링크 생성 (간단한 형태)
        const shareText = `${place.name}\n주소: ${place.address}${place.description ? '\n설명: ' + place.description : ''}`;
        
        if (navigator.share) {
            navigator.share({
                title: place.name,
                text: shareText,
                url: window.location.href
            }).catch(err => {
                console.log('공유 실패:', err);
                copyToClipboard(shareText);
            });
        } else {
            copyToClipboard(shareText);
        }
    }
    
    // 클립보드에 복사
    function copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                alert('장소 정보가 클립보드에 복사되었습니다.');
            }).catch(err => {
                console.error('복사 실패:', err);
                fallbackCopyToClipboard(text);
            });
        } else {
            fallbackCopyToClipboard(text);
        }
    }
    
    // 클립보드 복사 폴백
    function fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            alert('장소 정보가 클립보드에 복사되었습니다.');
        } catch (err) {
            console.error('복사 실패:', err);
            alert('장소 정보:\n\n' + text);
        }
        document.body.removeChild(textArea);
    }
    
    // 장소 삭제
    function deletePlace(placeId) {
        if (!confirm('이 장소를 삭제하시겠습니까?')) {
            return;
        }
        
        const savedPlaces = JSON.parse(localStorage.getItem('savedPlaces') || '[]');
        const filteredPlaces = savedPlaces.filter(p => p.id !== placeId);
        localStorage.setItem('savedPlaces', JSON.stringify(filteredPlaces));
        
        loadSavedPlaces();
        alert('장소가 삭제되었습니다.');
    }
    
    // 사이드바 탭 전환
    const sidebarTabButtons = document.querySelectorAll('.sidebar-tab-btn');
    sidebarTabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            
            // 모든 탭 버튼에서 active 클래스 제거
            sidebarTabButtons.forEach(b => b.classList.remove('active'));
            // 클릭한 버튼에 active 클래스 추가
            this.classList.add('active');
            
            // 탭 내용 전환
            const placesList = document.getElementById('places-list');
            const savedPlacesList = document.getElementById('saved-places-list');
            
            if (tab === 'recommended') {
                if (placesList) placesList.style.display = 'flex';
                if (savedPlacesList) savedPlacesList.style.display = 'none';
            } else if (tab === 'saved') {
                if (placesList) placesList.style.display = 'none';
                if (savedPlacesList) savedPlacesList.style.display = 'flex';
                loadSavedPlaces();
            }
        });
    });
    
    // 페이지 로드 시 저장된 장소 목록 불러오기
    if (document.getElementById('map-page')) {
        loadSavedPlaces();
    }
    
    // 독서 기록 남기기 버튼 (이벤트 위임 사용)
    document.addEventListener('click', function(e) {
        if (e.target.closest('.place-record-btn')) {
            const button = e.target.closest('.place-record-btn');
            const placeItem = button.closest('.place-item');
            const placeName = placeItem.querySelector('.place-name')?.textContent || '이 장소';
            const placeAddress = placeItem.querySelector('.place-address')?.textContent || '';
            
            console.log('📝 독서 기록 남기기:', placeName, placeAddress);
            
            // 독서 기록 저장
            saveReadingRecord(placeName, placeAddress);
        }
    });
    
    // 도서 검색 기능
    const bookSearchInput = document.getElementById('book-search-input');
    const bookSearchIcon = document.querySelector('.book-search-icon');
    const bookSortSelect = document.getElementById('book-sort-select');
    const booksGrid = document.getElementById('books-grid');
    
    // 검색 실행 함수
    function performBookSearch() {
        if (!booksGrid) return;
        
        const searchTerm = bookSearchInput?.value.trim().toLowerCase() || '';
        const sortOption = bookSortSelect?.value || 'name';
        const bookCards = Array.from(booksGrid.querySelectorAll('.book-card'));
        
        // 검색 필터링
        let filteredBooks = bookCards;
        if (searchTerm) {
            filteredBooks = bookCards.filter(card => {
                const title = card.querySelector('.book-card-title')?.textContent.toLowerCase() || '';
                const author = card.querySelector('.book-card-author')?.textContent.toLowerCase() || '';
                return title.includes(searchTerm) || author.includes(searchTerm);
            });
        }
        
        // 정렬
        filteredBooks.sort((a, b) => {
            const titleA = a.querySelector('.book-card-title')?.textContent || '';
            const titleB = b.querySelector('.book-card-title')?.textContent || '';
            
            switch(sortOption) {
                case 'name':
                    // 이름순: 제목 기준 알파벳 순
                    return titleA.localeCompare(titleB, 'en');
                case 'recommended':
                    // 추천순: 추천 점수 기준 내림차순 (높은 점수 우선)
                    const recommendedA = parseInt(a.dataset.recommended) || 0;
                    const recommendedB = parseInt(b.dataset.recommended) || 0;
                    if (recommendedB !== recommendedA) {
                        return recommendedB - recommendedA;
                    }
                    // 점수가 같으면 이름순으로 정렬
                    return titleA.localeCompare(titleB, 'en');
                case 'weekday':
                    // 주중 인기순: 주중 조회수 기준 내림차순 (높은 조회수 우선)
                    const weekdayA = parseInt(a.dataset.weekdayViews) || 0;
                    const weekdayB = parseInt(b.dataset.weekdayViews) || 0;
                    if (weekdayB !== weekdayA) {
                        return weekdayB - weekdayA;
                    }
                    // 조회수가 같으면 이름순으로 정렬
                    return titleA.localeCompare(titleB, 'en');
                case 'monthly':
                    // 월간 인기순: 월간 조회수 기준 내림차순 (높은 조회수 우선)
                    const monthlyA = parseInt(a.dataset.monthlyViews) || 0;
                    const monthlyB = parseInt(b.dataset.monthlyViews) || 0;
                    if (monthlyB !== monthlyA) {
                        return monthlyB - monthlyA;
                    }
                    // 조회수가 같으면 이름순으로 정렬
                    return titleA.localeCompare(titleB, 'en');
                default:
                    return 0;
            }
        });
        
        // 필터링된 결과를 정렬된 순서대로 DOM에 재배치
        filteredBooks.forEach(card => {
            booksGrid.appendChild(card);
            card.style.display = 'block';
        });
        
        // 필터링되지 않은 카드는 숨김
        bookCards.forEach(card => {
            if (!filteredBooks.includes(card)) {
                card.style.display = 'none';
            }
        });
    }
    
    // 검색 아이콘 클릭 이벤트
    if (bookSearchIcon) {
        bookSearchIcon.addEventListener('click', function() {
            performBookSearch();
        });
    }
    
    // 검색 입력창 Enter 키 이벤트
    if (bookSearchInput) {
        bookSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performBookSearch();
            }
        });
        
        // 입력 시 실시간 검색 (선택사항 - 필요시 활성화)
        // bookSearchInput.addEventListener('input', performBookSearch);
    }
    
    // 정렬 드롭다운 변경 이벤트
    if (bookSortSelect) {
        bookSortSelect.addEventListener('change', function() {
            performBookSearch();
        });
    }
    
    // 줄거리 팝업 기능
    const bookSummaryButtons = document.querySelectorAll('.book-summary-btn');
    bookSummaryButtons.forEach(button => {
        button.addEventListener('click', function() {
            const bookId = this.getAttribute('data-book');
            const popup = document.getElementById(`summary-popup-${bookId}`);
            const bookCard = this.closest('.book-card');
            
            if (popup && bookCard) {
                // 기존에 열려있는 모든 팝업창 닫기
                const allPopups = document.querySelectorAll('.book-summary-popup');
                allPopups.forEach(existingPopup => {
                    existingPopup.classList.remove('active');
                });
                
                // 도서 카드의 위치와 크기 가져오기
                const cardRect = bookCard.getBoundingClientRect();
                const cardWidth = cardRect.width;
                const cardHeight = cardRect.height;
                
                // 팝업창 크기를 도서 카드의 1.3배로 설정
                popup.style.width = `${cardWidth * 1.3}px`;
                popup.style.height = `${cardHeight * 1.3}px`;
                
                // 팝업창 위치를 도서 카드 기준으로 설정 (중앙 정렬)
                const popupWidth = cardWidth * 1.3;
                const popupHeight = cardHeight * 1.3;
                const left = cardRect.left - (popupWidth - cardWidth) / 2;
                const top = cardRect.top - (popupHeight - cardHeight) / 2;
                
                // 화면 밖으로 나가지 않도록 조정
                const maxLeft = window.innerWidth - popupWidth;
                const maxTop = window.innerHeight - popupHeight;
                const finalLeft = Math.max(0, Math.min(left, maxLeft));
                const finalTop = Math.max(0, Math.min(top, maxTop));
                
                popup.style.left = `${finalLeft}px`;
                popup.style.top = `${finalTop}px`;
                popup.classList.add('active');
            }
        });
    });
    
    // 팝업 닫기 기능
    const summaryCloseButtons = document.querySelectorAll('.summary-popup-close');
    summaryCloseButtons.forEach(button => {
        button.addEventListener('click', function() {
            const popup = this.closest('.book-summary-popup');
            if (popup) {
                popup.classList.remove('active');
            }
        });
    });
    
    // 팝업 외부 클릭 시 닫기 (선택사항)
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('book-summary-popup')) {
            e.target.classList.remove('active');
        }
    });
    
    // 원서 선택 기능
    const bookSelectButtons = document.querySelectorAll('.book-select-btn');
    bookSelectButtons.forEach(button => {
        button.addEventListener('click', function() {
            const bookId = this.getAttribute('data-book');
            const bookCard = this.closest('.book-card');
            const bookTitle = bookCard.querySelector('.book-card-title')?.textContent || '선택한 책';
            
            console.log('선택한 책:', bookId, bookTitle);
            // AI 뷰어 페이지로 이동
            showPage('ai-viewer-page');
        });
    });

    // view-btn 클릭 이벤트: 책 목록에서 AI 뷰어로 전환하고 1장 로드
    const viewButtons = document.querySelectorAll('.view-btn');
    viewButtons.forEach(button => {
        button.addEventListener('click', async function() {
            // data-book-title 속성에서 책 제목 가져오기
            const bookTitle = this.getAttribute('data-book-title');
            
            if (!bookTitle) {
                console.error('❌ data-book-title 속성이 없습니다.');
                return;
            }
            
            console.log('📖 선택한 책:', bookTitle);
            
            // 현재 선택된 책 제목 저장
            currentBookTitle = bookTitle;
            currentViewerLevel = 'beginner'; // 초기 레벨은 beginner
            cachedTotalChapters = null; // 캐시 초기화
            
            // AI 뷰어 페이지로 전환
            showPage('ai-viewer-page');
            
            // 목차에 책 이름 업데이트 및 동적 생성 (챕터 수 가져오기, beginner 레벨)
            await updateTableOfContents(bookTitle, null, 'beginner');
            
            // 페이지 전환 후 약간의 지연을 두고 챕터 로드 (DOM 업데이트 대기)
            setTimeout(async () => {
                try {
                    // loadChapter 함수가 전역 스코프에 있는지 확인
                    if (typeof loadChapter === 'function') {
                        // 레벨별 첫 번째 챕터 로드
                        const totalChapters = cachedTotalChapters || (bookTitle === 'The Great Gatsby' ? 10 : 61);
                        const chapterRange = getChaptersForLevel('beginner', totalChapters);
                        const firstChapter = chapterRange.start;
                        
                        await loadChapter(bookTitle, firstChapter);
                        currentViewerChapter = firstChapter;
                        
                        // 뷰어 섹션으로 스크롤
                        const viewerElement = document.getElementById('original-text-viewer');
                        if (viewerElement) {
                            viewerElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        } else {
                            // viewer 요소가 없으면 ai-viewer-page로 스크롤
                            const aiViewerPage = document.getElementById('ai-viewer-page');
                            if (aiViewerPage) {
                                aiViewerPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        }
                    } else {
                        console.error('❌ loadChapter 함수를 찾을 수 없습니다. viewer.js가 로드되었는지 확인하세요.');
                    }
                } catch (error) {
                    console.error('❌ 챕터 로드 오류:', error);
                }
            }, 100);
        });
    });

    // 설정 모달 기능
    const settingsBtn = document.getElementById('profile-settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsModalClose = document.getElementById('settings-modal-close');
    const settingsNickname = document.getElementById('settings-nickname');
    const settingsEmail = document.getElementById('settings-email');
    const settingsBio = document.getElementById('settings-bio');
    const settingsProfile = document.getElementById('settings-profile');
    const settingsUploadBtn = document.getElementById('settings-upload-btn');
    const profileImagePreview = document.getElementById('profile-image-preview');
    const profileNickname = document.getElementById('profile-nickname');
    const profileEmail = document.getElementById('profile-email');
    const profileBio = document.getElementById('profile-bio');
    const saveButtons = document.querySelectorAll('.settings-save-btn');

    // 설정 버튼 클릭 시 모달 열기
    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', function() {
            settingsModal.classList.add('active');
        });
    }

    // 모달 닫기 버튼
    if (settingsModalClose && settingsModal) {
        settingsModalClose.addEventListener('click', function() {
            settingsModal.classList.remove('active');
        });
    }

    // 모달 배경 클릭 시 닫기
    if (settingsModal) {
        settingsModal.addEventListener('click', function(e) {
            if (e.target === settingsModal) {
                settingsModal.classList.remove('active');
            }
        });
    }

    // 프로필 이미지 업로드 버튼
    if (settingsUploadBtn && settingsProfile) {
        settingsUploadBtn.addEventListener('click', function() {
            settingsProfile.click();
        });
    }

    // 설정 저장 함수
    function saveSettingsToStorage() {
        const settings = {
            nickname: settingsNickname?.value.trim() || '',
            email: settingsEmail?.value.trim() || '',
            bio: settingsBio?.value.trim() || '',
            profileImage: null
        };
        
        // 프로필 이미지가 있으면 base64로 저장
        const profileImg = profileImagePreview?.querySelector('img');
        if (profileImg && profileImg.src) {
            settings.profileImage = profileImg.src;
        }
        
        localStorage.setItem('userSettings', JSON.stringify(settings));
    }
    
    // 설정 불러오기 함수
    function loadSettingsFromStorage() {
        const savedSettings = localStorage.getItem('userSettings');
        
        // 저장된 설정이 없을 때 기본 한줄 소개 설정
        if (!savedSettings) {
            const defaultBio = '안녕하세요.';
            if (settingsBio) {
                settingsBio.value = defaultBio;
            }
            if (profileBio) {
                profileBio.textContent = defaultBio;
            }
            // 기본값 저장
            const defaultSettings = {
                nickname: settingsNickname?.value.trim() || '',
                email: settingsEmail?.value.trim() || '',
                bio: defaultBio,
                profileImage: null
            };
            localStorage.setItem('userSettings', JSON.stringify(defaultSettings));
            return;
        }
        
        try {
            const settings = JSON.parse(savedSettings);
            
            // 닉네임 불러오기
            if (settings.nickname && settingsNickname && profileNickname) {
                settingsNickname.value = settings.nickname;
                profileNickname.textContent = settings.nickname;
            }
            
            // 이메일 불러오기
            if (settings.email && settingsEmail && profileEmail) {
                settingsEmail.value = settings.email;
                profileEmail.textContent = settings.email;
            }
            
            // 한줄 소개 불러오기 (없으면 기본값 설정)
            const bioValue = settings.bio && settings.bio.trim() ? settings.bio : '안녕하세요.';
            if (settingsBio) {
                settingsBio.value = bioValue;
            }
            if (profileBio) {
                profileBio.textContent = bioValue;
            }
            // 기본값이 설정된 경우 저장
            if (!settings.bio || !settings.bio.trim()) {
                settings.bio = bioValue;
                localStorage.setItem('userSettings', JSON.stringify(settings));
            }
            
            // 프로필 이미지 불러오기
            if (settings.profileImage && profileImagePreview) {
                const img = document.createElement('img');
                img.src = settings.profileImage;
                img.alt = '프로필 이미지';
                profileImagePreview.innerHTML = '';
                profileImagePreview.appendChild(img);
                
                // 프로필 아바타도 업데이트
                const profileAvatar = document.querySelector('.profile-avatar');
                if (profileAvatar) {
                    profileAvatar.innerHTML = '';
                    const avatarImg = document.createElement('img');
                    avatarImg.src = settings.profileImage;
                    avatarImg.alt = '프로필 이미지';
                    avatarImg.style.width = '100%';
                    avatarImg.style.height = '100%';
                    avatarImg.style.objectFit = 'cover';
                    avatarImg.style.borderRadius = '50%';
                    profileAvatar.appendChild(avatarImg);
                }
            }
        } catch (error) {
            console.error('설정 불러오기 실패:', error);
        }
    }
    
    // 페이지 로드 시 설정 불러오기
    loadSettingsFromStorage();
    
    // 프로필 이미지 변경 시 자동 저장
    if (settingsProfile) {
        settingsProfile.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.alt = '프로필 이미지';
                    profileImagePreview.innerHTML = '';
                    profileImagePreview.appendChild(img);
                    
                    // 프로필 아바타도 업데이트
                    const profileAvatar = document.querySelector('.profile-avatar');
                    if (profileAvatar) {
                        profileAvatar.innerHTML = '';
                        const avatarImg = document.createElement('img');
                        avatarImg.src = e.target.result;
                        avatarImg.alt = '프로필 이미지';
                        avatarImg.style.width = '100%';
                        avatarImg.style.height = '100%';
                        avatarImg.style.objectFit = 'cover';
                        avatarImg.style.borderRadius = '50%';
                        profileAvatar.appendChild(avatarImg);
                    }
                    
                    // 자동 저장
                    saveSettingsToStorage();
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // 저장 버튼 클릭 이벤트
    saveButtons.forEach(button => {
        button.addEventListener('click', function() {
            const settingType = this.getAttribute('data-setting');
            
            if (settingType === 'nickname') {
                const newNickname = settingsNickname.value.trim();
                if (newNickname) {
                    profileNickname.textContent = newNickname;
                    saveSettingsToStorage();
                    alert('닉네임이 변경되었습니다.');
                } else {
                    alert('닉네임을 입력해주세요.');
                }
            } else if (settingType === 'email') {
                const newEmail = settingsEmail.value.trim();
                if (newEmail && newEmail.includes('@')) {
                    profileEmail.textContent = newEmail;
                    saveSettingsToStorage();
                    alert('이메일이 변경되었습니다.');
                } else {
                    alert('올바른 이메일을 입력해주세요.');
                }
            } else if (settingType === 'bio') {
                const newBio = settingsBio.value.trim();
                if (profileBio) {
                    profileBio.textContent = newBio || '';
                }
                saveSettingsToStorage();
                alert('한줄 소개가 저장되었습니다.');
            }
        });
    });

    // 플레이리스트 페이지 기능
    const playlistSearchInput = document.getElementById('playlist-search-input');
    const playlistSearchBtn = document.getElementById('playlist-search-btn');
    const musicSearchInput = document.getElementById('music-search-input');
    const musicSearchBtn = document.getElementById('music-search-btn');
    const musicPlayButtons = document.querySelectorAll('.music-play-btn');
    const musicCards = document.querySelectorAll('.music-card');

    // Spotify 검색 결과 컨테이너 요소
    const spotifySearchResults = document.getElementById('spotify-search-results');
    const spotifyResultsContainer = document.getElementById('spotify-results-container');

    /**
     * Spotify API를 사용하여 음악 검색
     * @param {string} query - 검색어
     */
    async function searchSpotifyMusic(query) {
        if (!query || !query.trim()) {
            return;
        }

        try {
            // 검색 결과 컨테이너 표시
            if (spotifySearchResults) {
                spotifySearchResults.style.display = 'block';
            }

            // 로딩 상태 표시
            if (spotifyResultsContainer) {
                spotifyResultsContainer.innerHTML = '<div class="search-loading">검색 중...</div>';
            }

            // 서버의 Spotify 검색 API 호출
            const response = await fetch(`http://127.0.0.1:11304/api/spotify/search?q=${encodeURIComponent(query)}&type=track&limit=20`, {
                credentials: 'include' // 세션 쿠키를 포함
            });
            
            if (!response.ok) {
                throw new Error(`검색 요청 실패: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success || !data.results || data.results.length === 0) {
                if (spotifyResultsContainer) {
                    spotifyResultsContainer.innerHTML = '<div class="search-no-results">검색 결과가 없습니다.</div>';
                }
                return;
            }

            // 검색 결과를 동적으로 표시
            displaySpotifyResults(data.results);

        } catch (error) {
            console.error('Spotify 검색 오류:', error);
            if (spotifyResultsContainer) {
                spotifyResultsContainer.innerHTML = `<div class="search-error">검색 중 오류가 발생했습니다: ${error.message}</div>`;
            }
        }
    }

    /**
     * Spotify 검색 결과를 화면에 동적으로 표시
     * @param {Array} tracks - 트랙 목록
     */
    function displaySpotifyResults(tracks) {
        if (!spotifyResultsContainer) return;

        if (tracks.length === 0) {
            spotifyResultsContainer.innerHTML = '<div class="search-no-results">검색 결과가 없습니다.</div>';
            return;
        }

        // 결과를 그리드 형태로 표시
        const resultsHTML = tracks.map(track => {
            const albumImage = track.album?.images?.[0]?.url || 'https://via.placeholder.com/150';
            const artistName = track.artists?.map(artist => artist.name).join(', ') || '알 수 없는 아티스트';
            const albumName = track.album?.name || '알 수 없는 앨범';
            const duration = formatDuration(track.duration_ms);

            // Spotify 트랙 URI 생성 (spotify:track:TRACK_ID 형식)
            const trackUri = track.uri || `spotify:track:${track.id}`;

            return `
                <div class="spotify-track-card" data-track-id="${track.id}" data-track-uri="${trackUri}">
                    <div class="track-image">
                        <img src="${albumImage}" alt="${track.name}" loading="lazy">
                    </div>
                    <div class="track-info">
                        <h4 class="track-title">${escapeHtml(track.name)}</h4>
                        <p class="track-artist">${escapeHtml(artistName)}</p>
                        <p class="track-album">${escapeHtml(albumName)}</p>
                        <p class="track-duration">${duration}</p>
                    </div>
                    <div class="track-actions">
                        <button type="button" class="track-play-btn" aria-label="재생" data-track-id="${track.id}" data-track-uri="${trackUri}" data-track-name="${escapeHtml(track.name)}" data-track-artist="${escapeHtml(artistName)}">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                        </button>
                        <button type="button" class="track-add-btn" aria-label="플레이리스트에 담기" data-track-id="${track.id}">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        spotifyResultsContainer.innerHTML = `<div class="spotify-results-grid">${resultsHTML}</div>`;
        
        // 재생 버튼 이벤트 리스너 연결
        attachSpotifyTrackPlayListeners();
    }

    /**
     * 밀리초를 분:초 형식으로 변환
     * @param {number} ms - 밀리초
     * @returns {string} - "분:초" 형식
     */
    function formatDuration(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * HTML 이스케이프 처리
     * @param {string} text - 이스케이프할 텍스트
     * @returns {string} - 이스케이프된 텍스트
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Spotify 검색 결과의 재생 버튼에 이벤트 리스너 연결
     */
    function attachSpotifyTrackPlayListeners() {
        const trackPlayButtons = document.querySelectorAll('.track-play-btn');
        
        trackPlayButtons.forEach(button => {
            // 기존 리스너 제거를 위해 클론 후 교체
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            newButton.addEventListener('click', async function(e) {
                e.stopPropagation();
                
                // 트랙 정보 가져오기
                const trackUri = this.getAttribute('data-track-uri');
                const trackName = this.getAttribute('data-track-name');
                const trackArtist = this.getAttribute('data-track-artist');
                const trackCard = this.closest('.spotify-track-card');
                
                if (!trackUri) {
                    console.error('트랙 URI를 찾을 수 없습니다.');
                    return;
                }

                // 플레이어가 초기화되었는지 확인
                if (!window.spotifyPlayer || !window.spotifyDeviceId) {
                    console.warn('Spotify 플레이어가 초기화되지 않았습니다.');
                    console.log('spotifyPlayer:', window.spotifyPlayer);
                    console.log('spotifyDeviceId:', window.spotifyDeviceId);
                    
                    // 플레이어는 있지만 deviceId가 없는 경우 (아직 ready 이벤트가 발생하지 않음)
                    // 재생 요청을 큐에 추가하고 alert를 표시하지 않음
                    if (window.spotifyPlayer && !window.spotifyDeviceId) {
                        console.log('⚠️ 플레이어가 준비 중입니다. 재생 요청을 큐에 추가합니다:', trackUri);
                        // 재생 요청을 큐에 추가
                        if (window.playTrack && typeof window.playTrack === 'function') {
                            window.playTrack(trackUri).catch(error => {
                                console.error('재생 요청 큐 추가 중 오류:', error);
                            });
                        }
                        return;
                    }
                    
                    // 플레이어가 아예 없는 경우 로그인 요청
                    const shouldLogin = confirm('Spotify 플레이어를 사용하려면 먼저 로그인해주세요.\n로그인하시겠습니까?');
                    if (shouldLogin && window.loginToSpotify) {
                        window.loginToSpotify();
                    }
                    return;
                }

                try {
                    // 헤더의 재생 정보 업데이트
                    const songTitle = document.querySelector('.song-title');
                    const artistName = document.querySelector('.artist-name');
                    
                    if (songTitle) songTitle.textContent = trackName || '재생 중...';
                    if (artistName) artistName.textContent = trackArtist || '';

                    // 재생 버튼 상태 업데이트 (모든 버튼 초기화 후 현재 버튼 활성화)
                    document.querySelectorAll('.track-play-btn').forEach(btn => {
                        btn.classList.remove('playing');
                        const svg = btn.querySelector('svg polygon');
                        if (svg) {
                            svg.setAttribute('points', '5 3 19 12 5 21 5 3'); // 재생 아이콘
                        }
                    });
                    
                    this.classList.add('playing');
                    // 일시정지 아이콘으로 변경
                    const currentSvg = this.querySelector('svg');
                    if (currentSvg) {
                        currentSvg.innerHTML = '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>';
                    }

                    // Web Playback SDK를 사용하여 트랙 재생
                    if (window.playTrack && typeof window.playTrack === 'function') {
                        await window.playTrack(trackUri);
                        console.log('✅ 트랙 재생 시작:', trackName, '-', trackArtist);
                    } else {
                        console.error('playTrack 함수를 찾을 수 없습니다.');
                        alert('재생 기능을 사용할 수 없습니다. 페이지를 새로고침해주세요.');
                    }

                } catch (error) {
                    console.error('트랙 재생 오류:', error);
                    alert('트랙을 재생하는 중 오류가 발생했습니다: ' + error.message);
                }
            });
        });
    }

    // 플레이리스트 검색 기능 (기존 로컬 검색)
    function performPlaylistSearch() {
        const searchInput = playlistSearchInput || musicSearchInput;
        if (!searchInput) return;
        
        const searchTerm = searchInput.value.trim().toLowerCase();
        const allMusicCards = document.querySelectorAll('.music-card');
        const allPlaylistCards = document.querySelectorAll('.public-playlist-card');
        
        if (!searchTerm) {
            // 검색어가 없으면 모든 카드 표시
            allMusicCards.forEach(card => {
                card.style.display = 'flex';
            });
            allPlaylistCards.forEach(card => {
                card.style.display = 'flex';
            });
            // Spotify 검색 결과 숨기기
            if (spotifySearchResults) {
                spotifySearchResults.style.display = 'none';
            }
            return;
        }
        
        // 음악 카드 검색 필터링
        allMusicCards.forEach(card => {
            const title = card.querySelector('.music-title')?.textContent.toLowerCase() || '';
            const artist = card.querySelector('.music-artist')?.textContent.toLowerCase() || '';
            const mood = card.querySelector('.music-mood')?.textContent.toLowerCase() || '';
            
            const matches = title.includes(searchTerm) || 
                          artist.includes(searchTerm) || 
                          mood.includes(searchTerm);
            
            card.style.display = matches ? 'flex' : 'none';
        });
        
        // 공개 플레이리스트 카드 검색 필터링
        allPlaylistCards.forEach(card => {
            const title = card.querySelector('.playlist-card-title')?.textContent.toLowerCase() || '';
            const creator = card.querySelector('.playlist-card-creator')?.textContent.toLowerCase() || '';
            const info = card.querySelector('.playlist-card-info')?.textContent.toLowerCase() || '';
            
            const matches = title.includes(searchTerm) || 
                          creator.includes(searchTerm) || 
                          info.includes(searchTerm);
            
            card.style.display = matches ? 'flex' : 'none';
        });
    }

    // Spotify 검색 버튼 클릭 이벤트
    if (musicSearchBtn) {
        musicSearchBtn.addEventListener('click', function() {
            const searchInput = musicSearchInput || playlistSearchInput;
            if (searchInput && searchInput.value.trim()) {
                searchSpotifyMusic(searchInput.value.trim());
            }
        });
    }

    // Spotify 검색 입력창 Enter 키 이벤트
    if (musicSearchInput) {
        musicSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                if (this.value.trim()) {
                    searchSpotifyMusic(this.value.trim());
                }
            }
        });
    }

    // 기존 검색 아이콘 클릭 이벤트 (하위 호환성)
    if (playlistSearchBtn && !musicSearchBtn) {
        playlistSearchBtn.addEventListener('click', function() {
            performPlaylistSearch();
        });
    }

    // 기존 검색 입력창 Enter 키 이벤트 (하위 호환성)
    if (playlistSearchInput && !musicSearchInput) {
        playlistSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performPlaylistSearch();
            }
        });
    }

    // 전역 재생 상태 관리
    let currentPlayingMusicId = null;
    let currentPlayingPlaylistId = null;

    // 헤더 재생/정지 버튼 상태 업데이트 함수
    function updateHeaderPlayPauseState(isPlaying) {
        const playPauseBtn = document.getElementById('play-pause-btn');
        const playIcon = playPauseBtn?.querySelector('.play-icon');
        const pauseIcon = playPauseBtn?.querySelector('.pause-icon');
        
        if (playPauseBtn && playIcon && pauseIcon) {
            if (isPlaying) {
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
            } else {
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
            }
        }
    }

    // 모든 재생 버튼 상태 초기화
    function resetAllPlayButtons() {
        const allPlayButtons = document.querySelectorAll('.music-play-btn, .playlist-play-btn');
        allPlayButtons.forEach(btn => {
            btn.classList.remove('playing');
            const icon = btn.querySelector('svg');
            if (icon) {
                icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
            }
        });
    }

    // 음악 재생 버튼 클릭 이벤트
    function attachMusicPlayButtonListeners() {
        const allMusicPlayButtons = document.querySelectorAll('.music-play-btn');
        allMusicPlayButtons.forEach(button => {
            // 기존 리스너 제거를 위해 새로 추가
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            newButton.addEventListener('click', function(e) {
                e.stopPropagation();
                const musicCard = this.closest('.music-card');
                const musicId = musicCard?.getAttribute('data-music-id');
                const title = musicCard?.querySelector('.music-title')?.textContent || '';
                const artist = musicCard?.querySelector('.music-artist')?.textContent || '';
                
                // 헤더의 플레이리스트 바 업데이트
                const songTitle = document.querySelector('.song-title');
                const artistName = document.querySelector('.artist-name');
                
                if (songTitle) songTitle.textContent = title;
                if (artistName) artistName.textContent = artist;
                
                // 재생 상태 확인
                const isCurrentlyPlaying = this.classList.contains('playing');
                
                if (isCurrentlyPlaying) {
                    // 정지
                    this.classList.remove('playing');
                    const playIcon = this.querySelector('svg');
                    if (playIcon) {
                        playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
                    }
                    updateHeaderPlayPauseState(false);
                    currentPlayingMusicId = null;
                } else {
                    // 재생
                    // 다른 모든 재생 버튼 초기화
                    resetAllPlayButtons();
                    
                    this.classList.add('playing');
                    const playIcon = this.querySelector('svg');
                    if (playIcon) {
                        playIcon.innerHTML = '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>';
                    }
                    updateHeaderPlayPauseState(true);
                    currentPlayingMusicId = musicId;
                    
                    // 최근 선택 목록에 추가 (localStorage)
                    const recentMusic = JSON.parse(localStorage.getItem('recentMusic') || '[]');
                    const newEntry = {
                        id: musicId,
                        title: title,
                        artist: artist,
                        timestamp: Date.now()
                    };
                    
                    // 중복 제거 (같은 ID가 있으면 제거)
                    const filteredRecent = recentMusic.filter(item => item.id !== musicId);
                    // 최신 항목을 맨 앞에 추가
                    filteredRecent.unshift(newEntry);
                    // 최대 10개만 유지
                    const limitedRecent = filteredRecent.slice(0, 10);
                    localStorage.setItem('recentMusic', JSON.stringify(limitedRecent));
                }
                
                console.log('음악 재생:', title, '-', artist, isCurrentlyPlaying ? '정지' : '재생');
            });
        });
    }

    // 초기 음악 재생 버튼 이벤트 리스너 연결
    attachMusicPlayButtonListeners();

    // 음악 카드 클릭 이벤트 (카드 전체 클릭 시 재생)
    musicCards.forEach(card => {
        card.addEventListener('click', function(e) {
            // 재생 버튼 클릭이 아닌 경우에만
            if (!e.target.closest('.music-play-btn')) {
                const playBtn = this.querySelector('.music-play-btn');
                if (playBtn) {
                    playBtn.click();
                }
            }
        });
    });

    // 페이지 로드 시 최근 선택 목록 불러오기
    function loadRecentMusic() {
        const recentMusic = JSON.parse(localStorage.getItem('recentMusic') || '[]');
        const recentMusicGrid = document.getElementById('recent-music');
        
        if (!recentMusicGrid || recentMusic.length === 0) return;
        
        // 기존 카드 제거 (샘플 데이터 제외하고 실제 데이터만 표시하려면)
        // 여기서는 기존 구조를 유지하고, 필요시 동적으로 업데이트할 수 있습니다.
        
        // 최근 음악 목록을 시간순으로 정렬하여 표시
        recentMusic.sort((a, b) => b.timestamp - a.timestamp);
        
        // 최근 음악 카드 업데이트 (선택사항 - 동적 생성)
        // 현재는 HTML에 하드코딩된 샘플 데이터를 사용하므로,
        // 필요시 여기서 동적으로 생성할 수 있습니다.
    }

    // 플레이리스트 페이지가 표시될 때 최근 음악 불러오기
    const playlistPage = document.getElementById('playlist-page');
    if (playlistPage) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const isVisible = playlistPage.style.display !== 'none';
                    if (isVisible) {
                        loadRecentMusic();
                    }
                }
            });
        });
        
        observer.observe(playlistPage, {
            attributes: true,
            attributeFilter: ['style']
        });
    }

    // 공개 플레이리스트 기능
    const publicPlaylistCards = document.querySelectorAll('.public-playlist-card');
    const playlistPlayButtons = document.querySelectorAll('.playlist-play-btn');
    const playlistAddButtons = document.querySelectorAll('.playlist-add-btn');

    // 공개 플레이리스트 재생 버튼 클릭 이벤트
    playlistPlayButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const playlistCard = this.closest('.public-playlist-card');
            const playlistId = playlistCard?.getAttribute('data-playlist-id');
            const playlistTitle = playlistCard?.querySelector('.playlist-card-title')?.textContent || '';
            const playlistCreator = playlistCard?.querySelector('.playlist-card-creator')?.textContent || '';
            
            // 헤더의 플레이리스트 바 업데이트
            const songTitle = document.querySelector('.song-title');
            const artistName = document.querySelector('.artist-name');
            
            if (songTitle) songTitle.textContent = playlistTitle;
            if (artistName) artistName.textContent = playlistCreator.replace('by ', '');
            
            // 최근 선택 목록에 추가 (localStorage)
            const recentMusic = JSON.parse(localStorage.getItem('recentMusic') || '[]');
            const newEntry = {
                id: playlistId,
                title: playlistTitle,
                artist: playlistCreator.replace('by ', ''),
                timestamp: Date.now(),
                type: 'playlist'
            };
            
            // 중복 제거
            const filteredRecent = recentMusic.filter(item => item.id !== playlistId);
            filteredRecent.unshift(newEntry);
            const limitedRecent = filteredRecent.slice(0, 10);
            localStorage.setItem('recentMusic', JSON.stringify(limitedRecent));
            
            // 재생 버튼 상태 변경
            const allPlayButtons = document.querySelectorAll('.playlist-play-btn');
            allPlayButtons.forEach(btn => {
                btn.classList.remove('playing');
                const icon = btn.querySelector('svg');
                if (icon) {
                    icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
                }
            });
            
            this.classList.add('playing');
            const playIcon = this.querySelector('svg');
            if (playIcon) {
                playIcon.innerHTML = '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>';
            }
            
            console.log('플레이리스트 재생:', playlistTitle);
        });
    });

    // 공개 플레이리스트 담기 버튼 클릭 이벤트
    playlistAddButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const playlistCard = this.closest('.public-playlist-card');
            const playlistId = playlistCard?.getAttribute('data-playlist-id');
            const playlistTitle = playlistCard?.querySelector('.playlist-card-title')?.textContent || '';
            const playlistCreator = playlistCard?.querySelector('.playlist-card-creator')?.textContent || '';
            
            // 내 플레이리스트에 추가 (localStorage)
            const myPlaylists = JSON.parse(localStorage.getItem('myPlaylists') || '[]');
            
            // 이미 담겨있는지 확인
            const isAlreadyAdded = myPlaylists.some(playlist => playlist.id === playlistId);
            
            if (isAlreadyAdded) {
                alert('이미 내 플레이리스트에 추가된 항목입니다.');
                return;
            }
            
            const newPlaylist = {
                id: playlistId,
                title: playlistTitle,
                creator: playlistCreator.replace('by ', ''),
                addedAt: Date.now()
            };
            
            myPlaylists.push(newPlaylist);
            localStorage.setItem('myPlaylists', JSON.stringify(myPlaylists));
            
            // 버튼 상태 변경
            this.classList.add('added');
            const addIcon = this.querySelector('svg');
            if (addIcon) {
                addIcon.setAttribute('viewBox', '0 0 24 24');
                addIcon.setAttribute('fill', 'none');
                addIcon.setAttribute('stroke', 'currentColor');
                addIcon.setAttribute('stroke-width', '2');
                addIcon.setAttribute('stroke-linecap', 'round');
                addIcon.setAttribute('stroke-linejoin', 'round');
                addIcon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
            }
            const span = this.querySelector('span');
            if (span) {
                span.textContent = '담김';
            }
            
            // 일정 시간 후 원래 상태로 복귀 (선택사항)
            setTimeout(() => {
                this.classList.remove('added');
                if (addIcon) {
                    addIcon.setAttribute('viewBox', '0 0 24 24');
                    addIcon.setAttribute('fill', 'none');
                    addIcon.setAttribute('stroke', 'currentColor');
                    addIcon.setAttribute('stroke-width', '2');
                    addIcon.setAttribute('stroke-linecap', 'round');
                    addIcon.setAttribute('stroke-linejoin', 'round');
                    addIcon.innerHTML = '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>';
                }
                if (span) {
                    span.textContent = '담기';
                }
            }, 2000);
            
            // 내 플레이리스트 업데이트
            loadMyPlaylists();
            
            console.log('플레이리스트 담기:', playlistTitle);
        });
    });

    // 공개 플레이리스트 데이터 (샘플)
    const playlistData = {
        'public-1': {
            title: '심야 독서를 위한 클래식',
            description: '깊은 밤, 집중력이 필요한 독서 시간에 듣기 좋은 클래식 음악 모음입니다. 평온하고 차분한 분위기로 독서에 몰입할 수 있도록 선별했습니다.',
            tracks: [
                { number: 1, title: 'Moonlight Sonata', artist: 'Ludwig van Beethoven' },
                { number: 2, title: 'Clair de Lune', artist: 'Claude Debussy' },
                { number: 3, title: 'Gymnopédie No. 1', artist: 'Erik Satie' },
                { number: 4, title: 'Nocturne Op. 9 No. 2', artist: 'Frédéric Chopin' },
                { number: 5, title: 'Canon in D', artist: 'Johann Pachelbel' },
                { number: 6, title: 'The Four Seasons - Spring', artist: 'Antonio Vivaldi' }
            ]
        },
        'public-2': {
            title: '집중력 향상을 위한 Lo-Fi',
            description: '공부와 독서에 최적화된 Lo-Fi 힙합 비트 모음입니다. 반복적이고 부드러운 멜로디가 집중력을 높여줍니다.',
            tracks: [
                { number: 1, title: 'Lo-Fi Study Beats', artist: 'Chillhop Music' },
                { number: 2, title: 'Coffee Break', artist: 'Lofi Hip Hop' },
                { number: 3, title: 'Rainy Day', artist: 'Ambient Beats' },
                { number: 4, title: 'Night Reading', artist: 'Study Vibes' },
                { number: 5, title: 'Peaceful Mind', artist: 'Lo-Fi Collective' }
            ]
        },
        'public-3': {
            title: '아침 독서를 위한 재즈',
            description: '상쾌한 아침 시간에 듣기 좋은 부드러운 재즈 음악 모음입니다. 하루를 시작하는 데 도움이 되는 밝고 경쾌한 멜로디를 담았습니다.',
            tracks: [
                { number: 1, title: 'Jazz for Reading', artist: 'Smooth Jazz Collection' },
                { number: 2, title: 'Morning Coffee', artist: 'Jazz Trio' },
                { number: 3, title: 'Sunny Day', artist: 'Jazz Ensemble' },
                { number: 4, title: 'Easy Listening', artist: 'Jazz Lounge' }
            ]
        },
        'public-4': {
            title: '비 오는 날의 독서 음악',
            description: '비가 내리는 날 창가에서 책을 읽으며 듣기 좋은 음악 모음입니다. 자연의 소리와 조화로운 멜로디가 편안한 분위기를 만들어줍니다.',
            tracks: [
                { number: 1, title: 'Rain Sounds for Reading', artist: 'Nature Ambience' },
                { number: 2, title: 'Thunderstorm', artist: 'Nature Sounds' },
                { number: 3, title: 'Rainy Window', artist: 'Ambient Nature' },
                { number: 4, title: 'Cozy Reading', artist: 'Rainy Day Music' }
            ]
        },
        'public-5': {
            title: '명상과 독서를 위한 앰비언트',
            description: '명상과 깊은 독서를 위한 앰비언트 음악 모음입니다. 마음을 평온하게 하고 집중력을 높여줍니다.',
            tracks: [
                { number: 1, title: 'Ambient Reading Sounds', artist: 'Nature Sounds' },
                { number: 2, title: 'Meditation Music', artist: 'Peaceful Sounds' },
                { number: 3, title: 'Deep Focus', artist: 'Ambient Collection' },
                { number: 4, title: 'Zen Reading', artist: 'Meditation Vibes' }
            ]
        },
        'public-6': {
            title: '바로크 시대의 독서 음악',
            description: '바로크 시대의 우아하고 정교한 클래식 음악 모음입니다. 고전 문학을 읽을 때 특히 잘 어울립니다.',
            tracks: [
                { number: 1, title: 'Canon in D', artist: 'Johann Pachelbel' },
                { number: 2, title: 'The Four Seasons - Spring', artist: 'Antonio Vivaldi' },
                { number: 3, title: 'Air on the G String', artist: 'Johann Sebastian Bach' },
                { number: 4, title: 'Water Music', artist: 'George Frideric Handel' }
            ]
        }
    };

    // 플레이리스트 상세 모달 열기
    function openPlaylistDetailModal(playlistId) {
        const modal = document.getElementById('playlist-detail-modal');
        const playlistInfo = playlistData[playlistId];
        
        if (!modal || !playlistInfo) return;
        
        // 모달 내용 업데이트
        document.getElementById('playlist-detail-title').textContent = playlistInfo.title;
        document.getElementById('playlist-detail-description').textContent = playlistInfo.description;
        
        // 썸네일 이미지 초기화 (공개 플레이리스트는 이미지 편집 불가)
        const thumbnailImg = document.getElementById('playlist-detail-thumbnail-img');
        const thumbnailSvg = document.getElementById('playlist-detail-thumbnail-svg');
        const editBtn = document.getElementById('playlist-thumbnail-edit-btn');
        
        if (thumbnailImg) {
            thumbnailImg.style.display = 'none';
        }
        if (thumbnailSvg) {
            thumbnailSvg.style.display = 'block';
        }
        if (editBtn) {
            editBtn.style.display = 'none';
        }
        
        // 좋아요 정보 업데이트
        const likeInfo = getPlaylistLikes(playlistId);
        const detailLikeBtn = document.getElementById('playlist-detail-like-btn');
        const detailLikeCount = document.getElementById('playlist-detail-like-count');
        
        if (detailLikeBtn) {
            detailLikeBtn.setAttribute('data-playlist-id', playlistId);
            if (likeInfo.liked) {
                detailLikeBtn.classList.add('liked');
            } else {
                detailLikeBtn.classList.remove('liked');
            }
        }
        
        if (detailLikeCount) {
            detailLikeCount.textContent = likeInfo.count;
        }
        
        // 곡 목록 업데이트
        const tracksList = document.getElementById('playlist-detail-tracks-list');
        tracksList.innerHTML = '';
        
        playlistInfo.tracks.forEach(track => {
            const trackItem = document.createElement('div');
            trackItem.className = 'playlist-detail-track-item';
            trackItem.innerHTML = `
                <div class="playlist-detail-track-number">${track.number}</div>
                <div class="playlist-detail-track-info">
                    <h4 class="playlist-detail-track-title">${escapeHtml(track.title)}</h4>
                    <p class="playlist-detail-track-artist">${escapeHtml(track.artist)}</p>
                </div>
                <button type="button" class="playlist-detail-track-play-btn" aria-label="재생" data-track-title="${escapeHtml(track.title)}" data-track-artist="${escapeHtml(track.artist)}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </button>
            `;
            tracksList.appendChild(trackItem);
        });
        
        // 모달 열기
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // 곡 재생 버튼 이벤트 리스너 추가
        attachTrackPlayButtonListeners();
        
        // 모달 내 좋아요 버튼 이벤트 리스너 추가
        attachModalLikeButtonListener();
    }
    
    // 모달 내 좋아요 버튼 이벤트 리스너
    function attachModalLikeButtonListener() {
        const detailLikeBtn = document.getElementById('playlist-detail-like-btn');
        if (!detailLikeBtn) return;
        
        // 기존 리스너 제거를 위해 새로 추가
        const newBtn = detailLikeBtn.cloneNode(true);
        detailLikeBtn.parentNode.replaceChild(newBtn, detailLikeBtn);
        
        newBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const playlistId = this.getAttribute('data-playlist-id');
            if (!playlistId) return;
            
            const currentLike = getPlaylistLikes(playlistId);
            const newLiked = !currentLike.liked;
            const updatedLike = setPlaylistLike(playlistId, newLiked);
            
            // 모달 내 UI 업데이트
            if (updatedLike.liked) {
                this.classList.add('liked');
            } else {
                this.classList.remove('liked');
            }
            const detailLikeCount = document.getElementById('playlist-detail-like-count');
            if (detailLikeCount) {
                detailLikeCount.textContent = updatedLike.count;
            }
            
            // 공개 플레이리스트와 내 플레이리스트 UI도 업데이트
            updatePlaylistLikeUI(playlistId);
            
            console.log('좋아요:', playlistId, newLiked ? '추가' : '제거', '총', updatedLike.count);
        });
    }

    // 플레이리스트 상세 모달 닫기
    function closePlaylistDetailModal() {
        const modal = document.getElementById('playlist-detail-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // 곡 재생 버튼 이벤트 리스너
    function attachTrackPlayButtonListeners() {
        const trackPlayButtons = document.querySelectorAll('.playlist-detail-track-play-btn');
        trackPlayButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                const title = this.getAttribute('data-track-title');
                const artist = this.getAttribute('data-track-artist');
                
                // 헤더의 플레이리스트 바 업데이트
                const songTitle = document.querySelector('.song-title');
                const artistName = document.querySelector('.artist-name');
                
                if (songTitle) songTitle.textContent = title;
                if (artistName) artistName.textContent = artist;
                
                // 재생 상태 확인
                const isCurrentlyPlaying = this.classList.contains('playing');
                
                if (isCurrentlyPlaying) {
                    // 정지
                    this.classList.remove('playing');
                    const icon = this.querySelector('svg');
                    if (icon) {
                        icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
                    }
                    updateHeaderPlayPauseState(false);
                    currentPlayingMusicId = null;
                } else {
                    // 재생
                    // 다른 모든 재생 버튼 초기화
                    resetAllPlayButtons();
                    trackPlayButtons.forEach(btn => {
                        btn.classList.remove('playing');
                        const icon = btn.querySelector('svg');
                        if (icon) {
                            icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
                        }
                    });
                    
                    this.classList.add('playing');
                    const icon = this.querySelector('svg');
                    if (icon) {
                        icon.innerHTML = '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>';
                    }
                    updateHeaderPlayPauseState(true);
                    currentPlayingMusicId = `track-${title}-${artist}`;
                }
                
                console.log('곡 재생:', title, '-', artist, isCurrentlyPlaying ? '정지' : '재생');
            });
        });
    }

    // 모달 닫기 버튼 이벤트
    const playlistDetailModalClose = document.getElementById('playlist-detail-modal-close');
    if (playlistDetailModalClose) {
        playlistDetailModalClose.addEventListener('click', function() {
            closePlaylistDetailModal();
        });
    }

    // 모달 배경 클릭 시 닫기
    const playlistDetailModal = document.getElementById('playlist-detail-modal');
    if (playlistDetailModal) {
        playlistDetailModal.addEventListener('click', function(e) {
            if (e.target === playlistDetailModal) {
                closePlaylistDetailModal();
            }
        });
    }

    // ESC 키로 모달 닫기
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closePlaylistDetailModal();
        }
    });

    // 좋아요 기능
    function getPlaylistLikes(playlistId) {
        const likes = JSON.parse(localStorage.getItem('playlistLikes') || '{}');
        return likes[playlistId] || { count: 0, liked: false };
    }

    function setPlaylistLike(playlistId, liked) {
        const likes = JSON.parse(localStorage.getItem('playlistLikes') || '{}');
        if (!likes[playlistId]) {
            likes[playlistId] = { count: 0, liked: false };
        }
        
        const currentLike = likes[playlistId];
        if (liked && !currentLike.liked) {
            currentLike.count += 1;
            currentLike.liked = true;
        } else if (!liked && currentLike.liked) {
            currentLike.count = Math.max(0, currentLike.count - 1);
            currentLike.liked = false;
        }
        
        likes[playlistId] = currentLike;
        localStorage.setItem('playlistLikes', JSON.stringify(likes));
        return currentLike;
    }

    function updatePlaylistLikeUI(playlistId) {
        const likeInfo = getPlaylistLikes(playlistId);
        const likeBtn = document.querySelector(`.playlist-like-btn[data-playlist-id="${playlistId}"]`);
        const likeCount = document.querySelector(`.playlist-like-count[data-playlist-id="${playlistId}"]`);
        
        if (likeBtn) {
            if (likeInfo.liked) {
                likeBtn.classList.add('liked');
            } else {
                likeBtn.classList.remove('liked');
            }
        }
        
        if (likeCount) {
            likeCount.textContent = likeInfo.count;
        }
    }

    // 좋아요 버튼 이벤트 리스너 (이벤트 위임 방식으로 변경)
    function attachLikeButtonListeners() {
        // 이벤트 위임을 사용하여 동적으로 생성되는 요소에도 작동하도록 함
        // 기존 리스너가 있으면 제거
        const playlistPage = document.getElementById('playlist-page');
        if (!playlistPage) return;
        
        // 기존 리스너 제거를 위해 새 리스너로 교체
        const existingHandler = playlistPage._likeButtonHandler;
        if (existingHandler) {
            playlistPage.removeEventListener('click', existingHandler);
        }
        
        // 새로운 이벤트 핸들러 생성
        const likeButtonHandler = function(e) {
            const likeButton = e.target.closest('.playlist-like-btn');
            if (!likeButton) return;
            
            e.stopPropagation();
            const playlistId = likeButton.getAttribute('data-playlist-id');
            if (!playlistId) return;
            
            const currentLike = getPlaylistLikes(playlistId);
            const newLiked = !currentLike.liked;
            const updatedLike = setPlaylistLike(playlistId, newLiked);
            
            // UI 업데이트
            updatePlaylistLikeUI(playlistId);
            
            // 내 플레이리스트에도 업데이트
            const myPlaylistLikeBtn = document.querySelector(`#my-playlists .playlist-like-btn[data-playlist-id="${playlistId}"]`);
            const myPlaylistLikeCount = document.querySelector(`#my-playlists .playlist-like-count[data-playlist-id="${playlistId}"]`);
            if (myPlaylistLikeBtn) {
                if (updatedLike.liked) {
                    myPlaylistLikeBtn.classList.add('liked');
                } else {
                    myPlaylistLikeBtn.classList.remove('liked');
                }
            }
            if (myPlaylistLikeCount) {
                myPlaylistLikeCount.textContent = updatedLike.count;
            }
            
            console.log('좋아요:', playlistId, newLiked ? '추가' : '제거', '총', updatedLike.count);
        };
        
        // 핸들러를 저장하여 나중에 제거할 수 있도록 함
        playlistPage._likeButtonHandler = likeButtonHandler;
        playlistPage.addEventListener('click', likeButtonHandler);
    }

    // 모든 플레이리스트 좋아요 UI 초기화
    function initializePlaylistLikes() {
        const allPlaylistIds = ['public-1', 'public-2', 'public-3', 'public-4', 'public-5', 'public-6'];
        allPlaylistIds.forEach(id => {
            updatePlaylistLikeUI(id);
        });
    }

    // 초기 좋아요 버튼 이벤트 리스너 연결
    attachLikeButtonListeners();
    initializePlaylistLikes();

    // 공개 플레이리스트 카드 클릭 이벤트 (카드 전체 클릭 시 모달 열기)
    publicPlaylistCards.forEach(card => {
        card.addEventListener('click', function(e) {
            // 버튼 클릭이 아닌 경우에만
            if (!e.target.closest('.playlist-play-btn') && 
                !e.target.closest('.playlist-add-btn') && 
                !e.target.closest('.playlist-like-btn')) {
                const playlistId = this.getAttribute('data-playlist-id');
                openPlaylistDetailModal(playlistId);
            }
        });
    });

    // 음악 카드 플레이리스트 담기 버튼
    const musicAddToPlaylistButtons = document.querySelectorAll('.music-add-to-playlist-btn');
    musicAddToPlaylistButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const musicCard = this.closest('.music-card');
            const musicId = musicCard?.getAttribute('data-music-id');
            const title = musicCard?.querySelector('.music-title')?.textContent || '';
            const artist = musicCard?.querySelector('.music-artist')?.textContent || '';
            
            // 플레이리스트 선택 모달 열기
            openSelectPlaylistModal(musicId, title, artist);
        });
    });
    
    // 플레이리스트 선택 모달 열기
    function openSelectPlaylistModal(musicId, musicTitle, musicArtist) {
        const modal = document.getElementById('select-playlist-modal');
        if (!modal) return;
        
        const collections = JSON.parse(localStorage.getItem('myPlaylistCollections') || '[]');
        const playlistList = document.getElementById('select-playlist-list');
        if (!playlistList) return;
        
        playlistList.innerHTML = '';
        
        if (collections.length === 0) {
            playlistList.innerHTML = '<p style="text-align: center; color: rgba(0,0,0,0.5); padding: 40px;">플레이리스트가 없습니다.<br>먼저 플레이리스트를 만들어주세요.</p>';
        } else {
            collections.forEach(collection => {
                const playlistItem = document.createElement('div');
                playlistItem.className = 'select-playlist-item';
                playlistItem.innerHTML = `
                    <div class="select-playlist-item-info">
                        <h4 class="select-playlist-item-title">${escapeHtml(collection.title)}</h4>
                        <p class="select-playlist-item-count">${collection.tracks ? collection.tracks.length : 0}곡</p>
                    </div>
                    <button type="button" class="select-playlist-item-btn" aria-label="추가" data-collection-id="${collection.id}" data-music-id="${musicId}" data-music-title="${escapeHtml(musicTitle)}" data-music-artist="${escapeHtml(musicArtist)}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                `;
                playlistList.appendChild(playlistItem);
            });
        }
        
        // 플레이리스트 선택 버튼 이벤트 리스너
        const selectPlaylistButtons = playlistList.querySelectorAll('.select-playlist-item-btn');
        selectPlaylistButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                const collectionId = this.getAttribute('data-collection-id');
                const targetMusicId = this.getAttribute('data-music-id');
                const targetMusicTitle = this.getAttribute('data-music-title');
                const targetMusicArtist = this.getAttribute('data-music-artist');
                
                const collections = JSON.parse(localStorage.getItem('myPlaylistCollections') || '[]');
                const collection = collections.find(c => c.id === collectionId);
                
                if (!collection) return;
                
                if (!collection.tracks) {
                    collection.tracks = [];
                }
                
                // 중복 확인
                const isDuplicate = collection.tracks.some(t => t.id === targetMusicId);
                if (isDuplicate) {
                    alert('이미 추가된 곡입니다.');
                    return;
                }
                
                collection.tracks.push({
                    id: targetMusicId,
                    title: targetMusicTitle,
                    artist: targetMusicArtist
                });
                
                localStorage.setItem('myPlaylistCollections', JSON.stringify(collections));
                
                // 버튼 상태 변경
                this.classList.add('added');
                const icon = this.querySelector('svg');
                if (icon) {
                    icon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
                }
                
                // 내 플레이리스트 카드 목록 업데이트
                loadMyPlaylists();
                
                // 모달 닫기
                setTimeout(() => {
                    closeSelectPlaylistModal();
                }, 500);
            });
        });
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    // 플레이리스트 선택 모달 닫기
    function closeSelectPlaylistModal() {
        const modal = document.getElementById('select-playlist-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
    
    // 플레이리스트 선택 모달 닫기 버튼
    const selectPlaylistModalClose = document.getElementById('select-playlist-modal-close');
    if (selectPlaylistModalClose) {
        selectPlaylistModalClose.addEventListener('click', closeSelectPlaylistModal);
    }
    
    // 플레이리스트 선택 모달 배경 클릭 시 닫기
    const selectPlaylistModal = document.getElementById('select-playlist-modal');
    if (selectPlaylistModal) {
        selectPlaylistModal.addEventListener('click', function(e) {
            if (e.target === selectPlaylistModal) {
                closeSelectPlaylistModal();
            }
        });
    }

    // 내 플레이리스트 불러오기 및 표시
    function loadMyPlaylists() {
        const myPlaylists = JSON.parse(localStorage.getItem('myPlaylists') || '[]');
        const myPlaylistsGrid = document.getElementById('my-playlists');
        const emptyMessage = document.getElementById('empty-playlist-message');
        
        if (!myPlaylistsGrid) return;
        
        // 기존 카드 제거
        myPlaylistsGrid.innerHTML = '';
        
        // 내가 만든 플레이리스트 모음 확인
        const myPlaylistCollections = JSON.parse(localStorage.getItem('myPlaylistCollections') || '[]');
        
        // myPlaylists와 myPlaylistCollections가 모두 비어있을 때만 빈 메시지 표시
        if (myPlaylists.length === 0 && myPlaylistCollections.length === 0) {
            if (emptyMessage) {
                emptyMessage.style.display = 'block';
                myPlaylistsGrid.appendChild(emptyMessage);
            }
            return;
        }
        
        if (emptyMessage) {
            emptyMessage.style.display = 'none';
        }
        
        // 플레이리스트와 음악을 추가된 시간순으로 정렬
        myPlaylists.sort((a, b) => b.addedAt - a.addedAt);
        
        // 내가 만든 플레이리스트 모음 표시
        myPlaylistCollections.sort((a, b) => b.createdAt - a.createdAt);
        
        myPlaylistCollections.forEach(collection => {
            const card = document.createElement('div');
            card.className = 'my-playlist-card';
            card.setAttribute('data-playlist-collection-id', collection.id);
            
            const trackCount = collection.tracks ? collection.tracks.length : 0;
            
            const isPublic = collection.isPublic !== false; // 기본값은 공개
            
            card.innerHTML = `
                <button class="share-playlist-btn" data-collection-id="${collection.id}" aria-label="플레이리스트 공유" title="플레이리스트 공유">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                </button>
                <button class="delete-playlist-btn" data-collection-id="${collection.id}" aria-label="플레이리스트 삭제" title="플레이리스트 삭제">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <div class="my-playlist-card-image">
                    ${collection.imageUrl ? `<img src="${escapeHtml(collection.imageUrl)}" alt="${escapeHtml(collection.title)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">` : `
                    <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="9" y1="3" x2="9" y2="21"></line>
                        <line x1="15" y1="3" x2="15" y2="21"></line>
                    </svg>`}
                    <button type="button" class="my-playlist-card-play-btn" aria-label="재생" data-collection-id="${collection.id}">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </button>
                </div>
                <div class="my-playlist-card-content">
                    <h4 class="my-playlist-card-title">${escapeHtml(collection.title)}</h4>
                </div>
            `;
            
            myPlaylistsGrid.appendChild(card);
        });
        
        myPlaylists.forEach(item => {
            if (item.type === 'playlist') {
                // 플레이리스트 카드 생성
                const card = document.createElement('div');
                card.className = 'my-playlist-card';
                card.setAttribute('data-playlist-id', item.id);
                
                // 공개 플레이리스트 데이터에서 정보 가져오기
                const playlistInfo = playlistData[item.id];
                const playlistTitle = playlistInfo ? playlistInfo.title : item.title;
                
                card.innerHTML = `
                    <div class="my-playlist-card-image">
                        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="9" y1="3" x2="9" y2="21"></line>
                            <line x1="15" y1="3" x2="15" y2="21"></line>
                        </svg>
                        <button type="button" class="my-playlist-card-play-btn" aria-label="재생" data-playlist-id="${item.id}">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </button>
                    </div>
                    <div class="my-playlist-card-content">
                        <h4 class="my-playlist-card-title">${escapeHtml(playlistTitle)}</h4>
                    </div>
                `;
                
                myPlaylistsGrid.appendChild(card);
            }
        });
        
        // 동적으로 생성된 버튼에 이벤트 리스너 추가
        attachMyPlaylistEventListeners();
        
        // 좋아요 버튼 이벤트 리스너 다시 연결 (동적으로 생성된 카드 포함)
        attachLikeButtonListeners();
        
        // 모든 플레이리스트 좋아요 UI 업데이트
        const allPlaylistIds = ['public-1', 'public-2', 'public-3', 'public-4', 'public-5', 'public-6'];
        allPlaylistIds.forEach(id => {
            updatePlaylistLikeUI(id);
        });
        
        // 내 플레이리스트 카드 클릭 이벤트 (미리보기 팝업 열기)
        const myPlaylistCards = document.querySelectorAll('#my-playlists .my-playlist-card');
        myPlaylistCards.forEach(card => {
            card.addEventListener('click', function(e) {
                if (!e.target.closest('.my-playlist-card-play-btn') && !e.target.closest('.delete-playlist-btn') && !e.target.closest('.share-playlist-btn')) {
                    const collectionId = this.getAttribute('data-playlist-collection-id');
                    const playlistId = this.getAttribute('data-playlist-id');
                    
                    if (collectionId) {
                        // 내 플레이리스트 모음인 경우
                        openMyPlaylistDetailModal(collectionId);
                    } else if (playlistId) {
                        // 담은 공개 플레이리스트인 경우
                        openPlaylistDetailModal(playlistId);
                    }
                }
            });
        });
        
        // 플레이리스트 공유 버튼 클릭 이벤트
        const sharePlaylistButtons = document.querySelectorAll('.share-playlist-btn');
        sharePlaylistButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                const collectionId = this.getAttribute('data-collection-id');
                if (collectionId) {
                    openSharePlaylistModal(collectionId);
                }
            });
        });
        
        // 내 플레이리스트 삭제 버튼 이벤트
        const deletePlaylistButtons = document.querySelectorAll('.delete-playlist-btn');
        deletePlaylistButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                const collectionId = this.getAttribute('data-collection-id');
                
                if (!collectionId) return;
                
                if (confirm('정말 이 플레이리스트를 삭제하시겠습니까?')) {
                    // localStorage에서 플레이리스트 컬렉션 제거
                    const collections = JSON.parse(localStorage.getItem('myPlaylistCollections') || '[]');
                    const filteredCollections = collections.filter(c => c.id !== collectionId);
                    localStorage.setItem('myPlaylistCollections', JSON.stringify(filteredCollections));
                    
                    // DOM에서 플레이리스트 카드 제거
                    const playlistCard = document.querySelector(`[data-playlist-collection-id="${collectionId}"]`);
                    if (playlistCard) {
                        playlistCard.remove();
                    }
                    
                    // 빈 메시지 표시 확인
                    loadMyPlaylists();
                }
            });
        });
        
        // 내 플레이리스트 카드 재생 버튼 이벤트
        const myPlaylistPlayButtons = document.querySelectorAll('#my-playlists .my-playlist-card-play-btn');
        myPlaylistPlayButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                const collectionId = this.getAttribute('data-collection-id');
                const playlistId = this.getAttribute('data-playlist-id');
                
                if (collectionId) {
                    // 내 플레이리스트 모음 재생
                    const collections = JSON.parse(localStorage.getItem('myPlaylistCollections') || '[]');
                    const collection = collections.find(c => c.id === collectionId);
                    if (collection && collection.tracks && collection.tracks.length > 0) {
                        const firstTrack = collection.tracks[0];
                        const songTitle = document.querySelector('.song-title');
                        const artistName = document.querySelector('.artist-name');
                        if (songTitle) songTitle.textContent = firstTrack.title;
                        if (artistName) artistName.textContent = firstTrack.artist;
                        updateHeaderPlayPauseState(true);
                        currentPlayingMusicId = `collection-${collectionId}`;
                    }
                } else if (playlistId) {
                    // 공개 플레이리스트 재생
                    const playlistInfo = playlistData[playlistId];
                    if (playlistInfo && playlistInfo.tracks && playlistInfo.tracks.length > 0) {
                        const firstTrack = playlistInfo.tracks[0];
                        const songTitle = document.querySelector('.song-title');
                        const artistName = document.querySelector('.artist-name');
                        if (songTitle) songTitle.textContent = firstTrack.title;
                        if (artistName) artistName.textContent = firstTrack.artist;
                        updateHeaderPlayPauseState(true);
                        currentPlayingPlaylistId = playlistId;
                    }
                }
            });
        });
    }
    
    // 내 플레이리스트 상세 모달 열기
    function openMyPlaylistDetailModal(collectionId) {
        const collections = JSON.parse(localStorage.getItem('myPlaylistCollections') || '[]');
        const collection = collections.find(c => c.id === collectionId);
        
        if (!collection) return;
        
        // 내 플레이리스트 상세 모달 사용
        const modal = document.getElementById('my-playlist-detail-modal');
        if (!modal) return;
        
        // 모달 내용 업데이트
        const titleEl = document.getElementById('my-playlist-detail-title');
        const descriptionEl = document.getElementById('my-playlist-detail-description');
        if (titleEl) titleEl.textContent = collection.title;
        if (descriptionEl) descriptionEl.textContent = collection.description || '설명이 없습니다.';
        
        
        // 좋아요 정보 업데이트
        const likeInfo = getPlaylistLikes(collectionId);
        const detailLikeBtn = document.getElementById('my-playlist-detail-like-btn');
        const detailLikeCount = document.getElementById('my-playlist-detail-like-count');
        
        if (detailLikeBtn) {
            detailLikeBtn.setAttribute('data-playlist-id', collectionId);
            if (likeInfo.liked) {
                detailLikeBtn.classList.add('liked');
            } else {
                detailLikeBtn.classList.remove('liked');
            }
        }
        
        if (detailLikeCount) {
            detailLikeCount.textContent = likeInfo.count;
        }
        
        // 곡 목록 업데이트
        const tracksList = document.getElementById('my-playlist-detail-tracks-list');
        tracksList.innerHTML = '';
        
        if (collection.tracks && collection.tracks.length > 0) {
            collection.tracks.forEach((track, index) => {
                const trackItem = document.createElement('div');
                trackItem.className = 'playlist-detail-track-item';
                trackItem.innerHTML = `
                    <div class="playlist-detail-track-number">${index + 1}</div>
                    <div class="playlist-detail-track-info">
                        <h4 class="playlist-detail-track-title">${escapeHtml(track.title)}</h4>
                        <p class="playlist-detail-track-artist">${escapeHtml(track.artist)}</p>
                    </div>
                    <button type="button" class="playlist-detail-track-play-btn" aria-label="재생" data-track-title="${escapeHtml(track.title)}" data-track-artist="${escapeHtml(track.artist)}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </button>
                    <button type="button" class="playlist-detail-track-remove-btn" aria-label="곡 삭제" data-collection-id="${collectionId}" data-track-index="${index}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                `;
                tracksList.appendChild(trackItem);
            });
        } else {
            tracksList.innerHTML = '<p style="text-align: center; color: rgba(0,0,0,0.5); padding: 40px;">아직 추가된 곡이 없습니다.</p>';
        }
        
        // 모달 열기
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // 곡 재생 버튼 이벤트 리스너 추가
        attachTrackPlayButtonListeners();
        
        // 곡 삭제 버튼 이벤트 리스너 추가
        attachTrackRemoveButtonListeners(collectionId);
        
        // 이미지 편집 버튼 이벤트 리스너 추가
        attachThumbnailEditButtonListener(collectionId);
        
        // 모달 내 좋아요 버튼 이벤트 리스너 추가
        attachMyPlaylistModalLikeButtonListener(collectionId);
    }
    
    // 내 플레이리스트 모달 내 좋아요 버튼 이벤트 리스너
    function attachMyPlaylistModalLikeButtonListener(collectionId) {
        const detailLikeBtn = document.getElementById('my-playlist-detail-like-btn');
        if (!detailLikeBtn) return;
        
        // 기존 리스너 제거를 위해 새로 추가
        const newBtn = detailLikeBtn.cloneNode(true);
        detailLikeBtn.parentNode.replaceChild(newBtn, detailLikeBtn);
        
        newBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const playlistId = this.getAttribute('data-playlist-id') || collectionId;
            if (!playlistId) return;
            
            const currentLike = getPlaylistLikes(playlistId);
            const newLiked = !currentLike.liked;
            const updatedLike = setPlaylistLike(playlistId, newLiked);
            
            // 모달 내 UI 업데이트
            if (updatedLike.liked) {
                this.classList.add('liked');
            } else {
                this.classList.remove('liked');
            }
            const detailLikeCount = document.getElementById('my-playlist-detail-like-count');
            if (detailLikeCount) {
                detailLikeCount.textContent = updatedLike.count;
            }
            
            // 공개 플레이리스트와 내 플레이리스트 UI도 업데이트
            updatePlaylistLikeUI(playlistId);
            
            console.log('좋아요:', playlistId, newLiked ? '추가' : '제거', '총', updatedLike.count);
        });
    }
    
    // 내 플레이리스트 상세 모달 닫기
    function closeMyPlaylistDetailModal() {
        const modal = document.getElementById('my-playlist-detail-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
    
    // 썸네일 편집 버튼 이벤트 리스너
    function attachThumbnailEditButtonListener(collectionId) {
        const editBtn = document.getElementById('playlist-thumbnail-edit-btn');
        const thumbnailInput = document.getElementById('playlist-thumbnail-input');
        
        if (!editBtn || !thumbnailInput) return;
        
        // 기존 이벤트 리스너 제거
        const newEditBtn = editBtn.cloneNode(true);
        editBtn.parentNode.replaceChild(newEditBtn, editBtn);
        
        newEditBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            thumbnailInput.click();
        });
        
        thumbnailInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            // 이미지 파일인지 확인
            if (!file.type.startsWith('image/')) {
                alert('이미지 파일만 업로드할 수 있습니다.');
                return;
            }
            
            // FileReader로 이미지 읽기
            const reader = new FileReader();
            reader.onload = function(event) {
                const imageUrl = event.target.result;
                
                // localStorage에 저장
                const collections = JSON.parse(localStorage.getItem('myPlaylistCollections') || '[]');
                const collection = collections.find(c => c.id === collectionId);
                
                if (collection) {
                    collection.imageUrl = imageUrl;
                    localStorage.setItem('myPlaylistCollections', JSON.stringify(collections));
                    
                    // UI 업데이트
                    const thumbnailImg = document.getElementById('playlist-detail-thumbnail-img');
                    const thumbnailSvg = document.getElementById('playlist-detail-thumbnail-svg');
                    
                    if (thumbnailImg) {
                        thumbnailImg.src = imageUrl;
                        thumbnailImg.style.display = 'block';
                    }
                    if (thumbnailSvg) {
                        thumbnailSvg.style.display = 'none';
                    }
                    
                    // 내 플레이리스트 카드 목록 업데이트
                    loadMyPlaylists();
                }
            };
            reader.readAsDataURL(file);
            
            // input 초기화
            e.target.value = '';
        });
    }
    
    // 곡 삭제 버튼 이벤트 리스너
    function attachTrackRemoveButtonListeners(collectionId) {
        const removeButtons = document.querySelectorAll(`.playlist-detail-track-remove-btn[data-collection-id="${collectionId}"]`);
        removeButtons.forEach(button => {
            // 기존 이벤트 리스너 제거 (중복 방지)
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            // 버튼 활성화
            newButton.disabled = false;
            newButton.style.pointerEvents = 'auto';
            newButton.style.opacity = '1';
            newButton.style.cursor = 'pointer';
            
            // 새 이벤트 리스너 등록
            newButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const trackIndex = parseInt(this.getAttribute('data-track-index'));
                const collections = JSON.parse(localStorage.getItem('myPlaylistCollections') || '[]');
                const collection = collections.find(c => c.id === collectionId);
                
                if (collection && collection.tracks && collection.tracks[trackIndex]) {
                    // 곡 삭제 확인
                    const track = collection.tracks[trackIndex];
                    if (confirm(`"${track.title}"을(를) 플레이리스트에서 삭제하시겠습니까?`)) {
                        collection.tracks.splice(trackIndex, 1);
                        localStorage.setItem('myPlaylistCollections', JSON.stringify(collections));
                        
                        // 모달 다시 열기 (곡 목록 업데이트)
                        openMyPlaylistDetailModal(collectionId);
                        
                        // 내 플레이리스트 카드 목록 업데이트
                        loadMyPlaylists();
                    }
                }
            });
        });
    }

    // 내 플레이리스트 버튼 이벤트 리스너
    // 플레이리스트 공유 모달 열기
    function openSharePlaylistModal(collectionId) {
        const shareModal = document.getElementById('share-playlist-modal');
        const shareLinkInput = document.getElementById('share-playlist-link');
        const collections = JSON.parse(localStorage.getItem('myPlaylistCollections') || '[]');
        const collection = collections.find(c => c.id === collectionId);
        
        if (!shareModal || !collection) return;
        
        // 공유 링크 생성
        const shareLink = `${window.location.origin}${window.location.pathname}?playlist=${collectionId}`;
        if (shareLinkInput) {
            shareLinkInput.value = shareLink;
        }
        
        // 현재 공개 설정 반영
        const visibilityRadios = document.querySelectorAll('input[name="share-playlist-visibility"]');
        const isPublic = collection.isPublic !== false;
        visibilityRadios.forEach(radio => {
            if (radio.value === (isPublic ? 'public' : 'private')) {
                radio.checked = true;
            }
        });
        
        shareModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    // 플레이리스트 공유 모달 닫기
    function closeSharePlaylistModal() {
        const shareModal = document.getElementById('share-playlist-modal');
        if (shareModal) {
            shareModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
    
    // 공유 링크 복사
    const sharePlaylistModal = document.getElementById('share-playlist-modal');
    const sharePlaylistModalClose = document.getElementById('share-playlist-modal-close');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const sharePlaylistLinkInput = document.getElementById('share-playlist-link');
    
    if (sharePlaylistModalClose) {
        sharePlaylistModalClose.addEventListener('click', closeSharePlaylistModal);
    }
    
    if (sharePlaylistModal) {
        sharePlaylistModal.addEventListener('click', function(e) {
            if (e.target === sharePlaylistModal) {
                closeSharePlaylistModal();
            }
        });
    }
    
    if (copyLinkBtn && sharePlaylistLinkInput) {
        copyLinkBtn.addEventListener('click', function() {
            sharePlaylistLinkInput.select();
            document.execCommand('copy');
            const originalText = copyLinkBtn.innerHTML;
            copyLinkBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> 복사됨';
            setTimeout(() => {
                copyLinkBtn.innerHTML = originalText;
            }, 2000);
        });
    }
    
    // 공개/비공개 설정 변경
    const shareVisibilityRadios = document.querySelectorAll('input[name="share-playlist-visibility"]');
    shareVisibilityRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const shareModal = sharePlaylistModal;
            if (!shareModal || !shareModal.classList.contains('active')) return;
            
            const activeCollectionId = sharePlaylistLinkInput?.value.match(/playlist=([^&]+)/)?.[1];
            if (!activeCollectionId) return;
            
            const collections = JSON.parse(localStorage.getItem('myPlaylistCollections') || '[]');
            const collectionIndex = collections.findIndex(c => c.id === activeCollectionId);
            
            if (collectionIndex !== -1) {
                collections[collectionIndex].isPublic = this.value === 'public';
                localStorage.setItem('myPlaylistCollections', JSON.stringify(collections));
                loadMyPlaylists();
            }
        });
    });

    function attachMyPlaylistEventListeners() {
        // 제거 버튼
        const removeButtons = document.querySelectorAll('.playlist-remove-btn, .music-remove-btn');
        removeButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.getAttribute('data-playlist-id') || this.getAttribute('data-music-id');
                const type = this.classList.contains('playlist-remove-btn') ? 'playlist' : 'music';
                
                const myPlaylists = JSON.parse(localStorage.getItem('myPlaylists') || '[]');
                const filtered = myPlaylists.filter(item => !(item.id === id && item.type === type));
                localStorage.setItem('myPlaylists', JSON.stringify(filtered));
                
                // 현재 재생 중인 항목이 제거되면 재생 상태 초기화
                if ((type === 'playlist' && currentPlayingPlaylistId === id) || 
                    (type === 'music' && currentPlayingMusicId === id)) {
                    updateHeaderPlayPauseState(false);
                    currentPlayingMusicId = null;
                    currentPlayingPlaylistId = null;
                }
                
                // 카드 제거
                const card = this.closest('.public-playlist-card, .music-card');
                if (card) {
                    card.remove();
                }
                
                // 빈 메시지 표시 확인
                loadMyPlaylists();
                
                alert('플레이리스트에서 제거되었습니다.');
            });
        });
    }

    // 새 플레이리스트 만들기 기능
    const createPlaylistBtn = document.getElementById('create-playlist-btn');
    const createPlaylistModal = document.getElementById('create-playlist-modal');
    const createPlaylistModalClose = document.getElementById('create-playlist-modal-close');
    const createPlaylistCancelBtn = document.getElementById('create-playlist-cancel-btn');
    const createPlaylistSubmitBtn = document.getElementById('create-playlist-submit-btn');
    const newPlaylistNameInput = document.getElementById('new-playlist-name');
    const newPlaylistDescriptionInput = document.getElementById('new-playlist-description');
    
    // 새 플레이리스트 만들기 버튼 클릭
    if (createPlaylistBtn && createPlaylistModal) {
        createPlaylistBtn.addEventListener('click', function() {
            createPlaylistModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            if (newPlaylistNameInput) {
                newPlaylistNameInput.value = '';
            }
            if (newPlaylistDescriptionInput) {
                newPlaylistDescriptionInput.value = '';
            }
        });
    }
    
    // 플레이리스트 생성 모달 닫기
    function closeCreatePlaylistModal() {
        if (createPlaylistModal) {
            createPlaylistModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
    
    if (createPlaylistModalClose) {
        createPlaylistModalClose.addEventListener('click', closeCreatePlaylistModal);
    }
    
    if (createPlaylistCancelBtn) {
        createPlaylistCancelBtn.addEventListener('click', closeCreatePlaylistModal);
    }
    
    if (createPlaylistModal) {
        createPlaylistModal.addEventListener('click', function(e) {
            if (e.target === createPlaylistModal) {
                closeCreatePlaylistModal();
            }
        });
    }
    
    // 내 플레이리스트 상세 모달 닫기 버튼 이벤트 리스너
    const myPlaylistDetailModalClose = document.getElementById('my-playlist-detail-modal-close');
    if (myPlaylistDetailModalClose) {
        myPlaylistDetailModalClose.addEventListener('click', closeMyPlaylistDetailModal);
    }
    
    // 내 플레이리스트 상세 모달 배경 클릭 시 닫기
    const myPlaylistDetailModal = document.getElementById('my-playlist-detail-modal');
    if (myPlaylistDetailModal) {
        myPlaylistDetailModal.addEventListener('click', function(e) {
            if (e.target === myPlaylistDetailModal) {
                closeMyPlaylistDetailModal();
            }
        });
    }
    
    // 플레이리스트 생성 제출
    if (createPlaylistSubmitBtn && newPlaylistNameInput) {
        createPlaylistSubmitBtn.addEventListener('click', function() {
            const playlistName = newPlaylistNameInput.value.trim();
            const playlistDescription = newPlaylistDescriptionInput?.value.trim() || '';
            
            if (!playlistName) {
                alert('플레이리스트 이름을 입력해주세요.');
                return;
            }
            
            // 공개/비공개 설정 가져오기
            const visibilityRadio = document.querySelector('input[name="playlist-visibility"]:checked');
            const isPublic = visibilityRadio ? visibilityRadio.value === 'public' : true;
            
            const collections = JSON.parse(localStorage.getItem('myPlaylistCollections') || '[]');
            const newCollection = {
                id: `my-collection-${Date.now()}`,
                title: playlistName,
                description: playlistDescription,
                tracks: [],
                isPublic: isPublic,
                createdAt: Date.now()
            };
            
            collections.push(newCollection);
            localStorage.setItem('myPlaylistCollections', JSON.stringify(collections));
            
            closeCreatePlaylistModal();
            loadMyPlaylists();
            alert(`"${playlistName}" 플레이리스트가 생성되었습니다.`);
        });
    }
    
    // Enter 키로 플레이리스트 생성
    if (newPlaylistNameInput && createPlaylistSubmitBtn) {
        newPlaylistNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                createPlaylistSubmitBtn.click();
            }
        });
    }

    // 플레이리스트 페이지가 표시될 때 내 플레이리스트 불러오기
    if (playlistPage) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const isVisible = playlistPage.style.display !== 'none';
                    if (isVisible) {
                        loadMyPlaylists();
                    }
                }
            });
        });
        
        observer.observe(playlistPage, {
            attributes: true,
            attributeFilter: ['style']
        });
    }
});

// Google Maps API 로드 함수
function loadGoogleMapsAPI() {
    // 이미 로드되어 있는지 확인
    if (window.google && window.google.maps) {
        console.log('✅ Google Maps API가 이미 로드되어 있습니다.');
        // 이미 로드되어 있으면 바로 지도 초기화
        if (typeof initMap === 'function') {
            initMap();
        }
        return;
    }

    // 이미 스크립트가 로드 중인지 확인
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        console.log('⏳ Google Maps API 스크립트가 이미 로드 중입니다.');
        return;
    }

    // MAPS_API_KEY 확인
    if (typeof MAPS_API_KEY === 'undefined' || !MAPS_API_KEY || MAPS_API_KEY.includes('발급받은')) {
        console.error('❌ MAPS_API_KEY가 설정되지 않았습니다. config.js 파일을 확인하세요.');
        const mapElement = document.getElementById('map');
        if (mapElement) {
            mapElement.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;"><p>⚠️ Google Maps API 키가 설정되지 않았습니다.</p><p>config.js 파일에 MAPS_API_KEY를 설정해주세요.</p></div>';
        }
        return;
    }

    console.log('🔄 Google Maps API를 로드하는 중...');

    // Google Maps API 스크립트 동적 로드 (Places 라이브러리 포함)
    const mapScriptUrl = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places&callback=initMap`;
    const script = document.createElement('script');
    script.src = mapScriptUrl;
    script.defer = true;
    script.async = true;
    
    // 에러 처리
    script.onerror = function() {
        console.error('❌ Google Maps API 스크립트 로드 실패');
        const mapElement = document.getElementById('map');
        if (mapElement) {
            mapElement.innerHTML = '<div style="padding: 20px; text-align: center; color: #d32f2f;"><p>❌ Google Maps API를 로드할 수 없습니다.</p><p>API 키와 네트워크 연결을 확인하세요.</p></div>';
        }
    };
    
    document.head.appendChild(script);
}

// Google Maps 라이브러리가 로드되면 자동으로 호출되는 함수
function initMap() {
    console.log('🗺️ initMap 함수 호출됨');
    
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error('❌ ID가 "map"인 요소를 찾을 수 없습니다.');
        return;
    }

    try {
        // 1. 지도 중심 좌표 설정 (예: 서울)
        const centerCoords = { lat: 37.5665, lng: 126.9780 };

        // 2. 새로운 지도 객체 생성 (ID가 "map"인 div에 연결)
        const map = new google.maps.Map(mapElement, {
            zoom: 12, // 초기 확대 레벨
            center: centerCoords // 중심 좌표
        });

        // 지도 객체를 전역 변수로 저장 (다른 함수에서 사용할 수 있도록)
        window.mapInstance = map;
        
        console.log('✅ Google Maps가 성공적으로 초기화되었습니다!');
        console.log('📍 중심 좌표:', centerCoords);
        console.log('🔍 확대 레벨:', 12);

        // 3. 지도 클릭 이벤트 추가 - 클릭한 위치 정보만 표시 (마커는 추가하지 않음)
        const infoWindow = new google.maps.InfoWindow();
        
        map.addListener('click', (event) => {
            const clickedLocation = {
                lat: event.latLng.lat(),
                lng: event.latLng.lng()
            };
            
            // 해당 위치에 이미 마커가 있는지 확인
            const existingMarker = currentMarkers.find(m => {
                const pos = m.getPosition();
                return pos && Math.abs(pos.lat() - clickedLocation.lat) < 0.0001 && 
                       Math.abs(pos.lng() - clickedLocation.lng) < 0.0001;
            });
            
            // 이미 마커가 있으면 해당 마커의 InfoWindow 표시
            if (existingMarker) {
                google.maps.event.trigger(existingMarker, 'click');
                return;
            }
            
            // InfoWindow 내용 생성 (마커 추가 버튼 포함)
            const locationId = `location-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const infoContent = `
                <div id="${locationId}" style="padding: 12px; min-width: 200px; font-family: 'Noto Sans KR', sans-serif;">
                    <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #333;">
                        📍 장소 정보
                    </h3>
                    <p style="margin: 0 0 6px 0; font-size: 13px; color: #666;">
                        <strong>위도:</strong> ${clickedLocation.lat.toFixed(6)}
                    </p>
                    <p style="margin: 0 0 12px 0; font-size: 13px; color: #666;">
                        <strong>경도:</strong> ${clickedLocation.lng.toFixed(6)}
                    </p>
                    <button 
                        id="add-marker-btn-${locationId}" 
                        class="info-window-add-marker-btn" 
                        style="width: 100%; padding: 8px 12px; background: rgba(78, 205, 196, 0.2); border: 1px solid rgba(78, 205, 196, 0.5); border-radius: 6px; cursor: pointer; transition: all 0.3s ease; color: #2d7d7a; font-size: 13px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 6px;"
                        title="이 위치에 마커 추가"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        <span>마커 추가</span>
                    </button>
                </div>
            `;
            
            // InfoWindow 표시 (마커 없이)
            infoWindow.close();
            infoWindow.setContent(infoContent);
            infoWindow.setPosition(clickedLocation);
            infoWindow.open(map);
            
            // InfoWindow가 DOM에 추가된 후 마커 추가 버튼 이벤트 리스너 추가
            google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
                const addMarkerBtn = document.getElementById(`add-marker-btn-${locationId}`);
                if (addMarkerBtn) {
                    addMarkerBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        
                        // 마커 생성
                        const marker = new google.maps.Marker({
                            position: clickedLocation,
                            map: map,
                            title: '선택한 장소',
                            icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 10,
                                fillColor: '#4ECDC4',
                                fillOpacity: 0.9,
                                strokeColor: '#FFFFFF',
                                strokeWeight: 2
                            },
                            animation: google.maps.Animation.DROP
                        });
                        
                        // 마커를 currentMarkers 배열에 추가
                        const markerId = `user-marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                        marker.markerId = markerId;
                        
                        // 마커에 장소 정보 저장
                        marker.placeName = '선택한 장소';
                        marker.placeLocation = clickedLocation;
                        
                        currentMarkers.push(marker);
                        
                        // 삭제 버튼 이벤트 리스너 추가 함수
                        const attachDeleteButtonListener = () => {
                            const deleteBtn = document.getElementById(`delete-marker-btn-${markerId}`);
                            if (deleteBtn) {
                                deleteBtn.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    // 마커 삭제
                                    marker.setMap(null);
                                    // currentMarkers 배열에서 제거
                                    const index = currentMarkers.indexOf(marker);
                                    if (index > -1) {
                                        currentMarkers.splice(index, 1);
                                    }
                                    // InfoWindow 닫기
                                    infoWindow.close();
                                    console.log('✅ 마커가 삭제되었습니다.');
                                });
                                
                                // 호버 효과
                                deleteBtn.addEventListener('mouseenter', () => {
                                    deleteBtn.style.background = '#f5f5f5';
                                    deleteBtn.style.transform = 'scale(1.1)';
                                });
                                
                                deleteBtn.addEventListener('mouseleave', () => {
                                    deleteBtn.style.background = '#ffffff';
                                    deleteBtn.style.transform = 'scale(1)';
                                });
                            }
                        };
                        
                        // 마커가 추가된 후 InfoWindow 내용 업데이트 (삭제 버튼 포함)
                        const updatedInfoContent = `
                            <div id="${markerId}" style="padding: 12px; min-width: 200px; font-family: 'Noto Sans KR', sans-serif; position: relative;">
                                <button 
                                    id="delete-marker-btn-${markerId}" 
                                    class="info-window-delete-btn" 
                                    style="position: absolute; top: 8px; right: 8px; background: #ffffff; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; color: #000000; padding: 0;"
                                    title="마커 삭제"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                                <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #333; padding-right: 40px;">
                                    📍 선택한 장소
                                </h3>
                                <p style="margin: 0 0 6px 0; font-size: 13px; color: #666;">
                                    <strong>위도:</strong> ${clickedLocation.lat.toFixed(6)}
                                </p>
                                <p style="margin: 0; font-size: 13px; color: #666;">
                                    <strong>경도:</strong> ${clickedLocation.lng.toFixed(6)}
                                </p>
                            </div>
                        `;
                        
                        // InfoWindow 내용 업데이트
                        infoWindow.setContent(updatedInfoContent);
                        infoWindow.open(map, marker);
                        
                        // 삭제 버튼 이벤트 리스너 추가
                        google.maps.event.addListenerOnce(infoWindow, 'domready', attachDeleteButtonListener);
                        
                        // 마커 클릭 시 InfoWindow 표시
                        marker.addListener('click', () => {
                            infoWindow.close();
                            infoWindow.setContent(updatedInfoContent);
                            infoWindow.open(map, marker);
                            
                            // InfoWindow가 DOM에 추가된 후 삭제 버튼 이벤트 리스너 추가
                            google.maps.event.addListenerOnce(infoWindow, 'domready', attachDeleteButtonListener);
                        });
                        
                        console.log('📍 마커가 추가되었습니다:', clickedLocation);
                    });
                    
                    // 호버 효과
                    addMarkerBtn.addEventListener('mouseenter', () => {
                        addMarkerBtn.style.background = 'rgba(78, 205, 196, 0.3)';
                        addMarkerBtn.style.borderColor = 'rgba(78, 205, 196, 0.7)';
                    });
                    
                    addMarkerBtn.addEventListener('mouseleave', () => {
                        addMarkerBtn.style.background = 'rgba(78, 205, 196, 0.2)';
                        addMarkerBtn.style.borderColor = 'rgba(78, 205, 196, 0.5)';
                    });
                }
            });
            
            console.log('📍 장소 정보 표시:', clickedLocation);
        });
        
        // Google Maps 기본 InfoWindow에 마커 추가/삭제 버튼 주입
        // 주기적으로 체크하는 함수
        const checkAndInjectButtons = () => {
            // Google Maps InfoWindow 컨테이너 찾기
            const infoWindowContainers = document.querySelectorAll('.gm-style-iw-d, .gm-style-iw-t');
            
            infoWindowContainers.forEach((infoWindowContainer) => {
                // 이미 버튼이 추가되었는지 확인
                if (infoWindowContainer.querySelector('.custom-marker-controls')) {
                    return;
                }
                
                // 우리가 만든 InfoWindow(지도 클릭 시 생성, 마커 클릭 시 생성)는 제외
                // 우리가 만든 InfoWindow는 특정 ID 패턴을 가짐
                if (infoWindowContainer.querySelector('[id^="location-"]') || 
                    infoWindowContainer.querySelector('[id^="place-info-"]') ||
                    infoWindowContainer.querySelector('[id^="marker-info-"]') ||
                    infoWindowContainer.querySelector('.info-window-add-marker-btn') ||
                    infoWindowContainer.querySelector('.info-window-delete-btn')) {
                    return;
                }
                
                // InfoWindow 내용에서 장소 정보 추출 시도
                const titleElement = infoWindowContainer.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"], .gm-style-iw-d > div:first-child');
                let placeName = '';
                
                if (titleElement) {
                    placeName = titleElement.textContent.trim();
                } else {
                    // 제목이 없는 경우 첫 번째 텍스트 노드 사용
                    const firstText = Array.from(infoWindowContainer.childNodes).find(node => 
                        node.nodeType === 3 && node.textContent.trim()
                    );
                    if (firstText) {
                        placeName = firstText.textContent.trim().split('\n')[0];
                    }
                }
                
                if (!placeName) {
                    return; // 장소 이름을 찾을 수 없으면 스킵
                }
                
                // InfoWindow의 위치 가져오기
                // Google Maps InfoWindow는 보통 .gm-style-iw-c 클래스를 가진 부모 요소에 위치 정보가 있음
                const infoWindowWrapper = infoWindowContainer.closest('.gm-style-iw-c');
                let placeLocation = null;
                
                // 1. 주소 링크에서 좌표 추출 시도 (가장 정확)
                const mapLink = infoWindowContainer.querySelector('a[href*="maps.google.com"], a[href*="google.com/maps"]');
                if (mapLink && mapLink.href) {
                    try {
                        const url = new URL(mapLink.href);
                        
                        // URL 경로에서 좌표 추출 (예: /@37.5665,126.9780,17z) - 가장 정확
                        const pathMatch = url.pathname.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
                        if (pathMatch) {
                            placeLocation = { lat: parseFloat(pathMatch[1]), lng: parseFloat(pathMatch[2]) };
                            console.log('📍 URL 경로에서 좌표 추출:', placeLocation);
                        }
                        
                        // URL 쿼리 파라미터에서 좌표 추출
                        if (!placeLocation) {
                            const query = url.searchParams.get('q') || url.searchParams.get('ll') || url.searchParams.get('center');
                            if (query) {
                                // 좌표 형식: "37.5665,126.9780" 또는 "37.5665, 126.9780"
                                const coords = query.split(/[,\s]+/).map(Number).filter(n => !isNaN(n));
                                if (coords.length >= 2) {
                                    placeLocation = { lat: coords[0], lng: coords[1] };
                                    console.log('📍 URL 쿼리에서 좌표 추출:', placeLocation);
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('좌표 추출 실패:', e);
                    }
                }
                
                // 2. Places API를 사용하여 장소 이름으로 검색 (정확도 높음)
                if (!placeLocation && placeName && window.google && window.google.maps && window.google.maps.places) {
                    try {
                        const placesService = new google.maps.places.PlacesService(map);
                        const request = {
                            query: placeName,
                            fields: ['geometry', 'name']
                        };
                        
                        placesService.textSearch(request, (results, status) => {
                            if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                                const firstResult = results[0];
                                if (firstResult.geometry && firstResult.geometry.location) {
                                    const location = {
                                        lat: firstResult.geometry.location.lat(),
                                        lng: firstResult.geometry.location.lng()
                                    };
                                    console.log('📍 Places API에서 좌표 추출:', location);
                                    
                                    // 버튼에 저장된 placeLocation 업데이트
                                    const addBtn = infoWindowContainer.querySelector('.custom-add-marker-btn');
                                    if (addBtn && addBtn.dataset) {
                                        addBtn.dataset.placeLat = location.lat;
                                        addBtn.dataset.placeLng = location.lng;
                                    }
                                    
                                    // 동적으로 마커 추가 버튼의 이벤트 리스너 업데이트
                                    if (addBtn) {
                                        const newAddBtn = addBtn.cloneNode(true);
                                        addBtn.parentNode.replaceChild(newAddBtn, addBtn);
                                        
                                        newAddBtn.addEventListener('click', (e) => {
                                            e.stopPropagation();
                                            const marker = new google.maps.Marker({
                                                position: location,
                                                map: map,
                                                title: placeName,
                                                icon: {
                                                    path: google.maps.SymbolPath.CIRCLE,
                                                    scale: 12,
                                                    fillColor: '#4ECDC4',
                                                    fillOpacity: 0.9,
                                                    strokeColor: '#FFFFFF',
                                                    strokeWeight: 2
                                                },
                                                animation: google.maps.Animation.DROP,
                                                markerId: `user-marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                                            });
                                            currentMarkers.push(marker);
                                            console.log('✅ 마커가 추가되었습니다 (Places API 좌표):', location);
                                        });
                                    }
                                }
                            }
                        });
                    } catch (e) {
                        console.warn('Places API 검색 실패:', e);
                    }
                }
                
                // InfoWindow가 표시되는 위치에서 좌표 추출 (마지막 수단)
                if (!placeLocation && infoWindowWrapper) {
                    // InfoWindow의 화면 위치를 지도 좌표로 변환
                    const rect = infoWindowWrapper.getBoundingClientRect();
                    const mapRect = mapElement.getBoundingClientRect();
                    // InfoWindow의 화살표가 가리키는 위치 (InfoWindow의 하단 중앙)
                    const x = rect.left + rect.width / 2 - mapRect.left;
                    const y = rect.bottom - mapRect.top; // InfoWindow의 하단 위치 사용 (화살표 위치)
                    
                    // 화면 좌표를 지도 좌표로 변환
                    try {
                        // Google Maps projection 사용 (가장 정확)
                        const projection = map.getProjection();
                        if (projection) {
                            const scale = Math.pow(2, map.getZoom());
                            const center = map.getCenter();
                            const centerPoint = projection.fromLatLngToPoint(center);
                            
                            // 픽셀 좌표를 지도 좌표로 변환
                            // Google Maps는 타일 크기가 256픽셀
                            const pixelX = (x - mapRect.width / 2) / (256 * scale);
                            const pixelY = (y - mapRect.height / 2) / (256 * scale);
                            
                            const point = new google.maps.Point(
                                centerPoint.x + pixelX,
                                centerPoint.y + pixelY
                            );
                            
                            const latLng = projection.fromPointToLatLng(point);
                            placeLocation = { lat: latLng.lat(), lng: latLng.lng() };
                            
                            console.log('📍 InfoWindow 위치에서 좌표 추출 (projection):', placeLocation);
                        } else {
                            // projection을 사용할 수 없는 경우 bounds 사용
                            const center = map.getCenter();
                            const bounds = map.getBounds();
                            if (bounds && center) {
                                const ne = bounds.getNorthEast();
                                const sw = bounds.getSouthWest();
                                const latRange = ne.lat() - sw.lat();
                                const lngRange = ne.lng() - sw.lng();
                                
                                const mapWidth = mapRect.width;
                                const mapHeight = mapRect.height;
                                
                                // 화면 좌표를 지도 좌표로 변환
                                const latOffset = (y / mapHeight) * latRange;
                                const lngOffset = ((x - mapWidth / 2) / mapWidth) * lngRange;
                                
                                placeLocation = {
                                    lat: center.lat() - latOffset,
                                    lng: center.lng() + lngOffset
                                };
                                
                                console.log('📍 InfoWindow 위치에서 좌표 추출 (bounds):', placeLocation);
                            }
                        }
                    } catch (e) {
                        console.warn('좌표 변환 실패:', e);
                    }
                }
                
                if (placeLocation) {
                    // 해당 위치에 이미 사용자 마커가 있는지 확인
                    const existingUserMarker = currentMarkers.find(m => {
                        if (!m.markerId || !m.markerId.startsWith('user-marker-')) return false;
                        const pos = m.getPosition();
                        return pos && Math.abs(pos.lat() - placeLocation.lat) < 0.0001 && 
                               Math.abs(pos.lng() - placeLocation.lng) < 0.0001;
                    });
                    
                    const hasUserMarker = !!existingUserMarker;
                    
                    // 버튼 컨테이너 생성
                    const controlsContainer = document.createElement('div');
                    controlsContainer.className = 'custom-marker-controls';
                    controlsContainer.style.cssText = 'margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.1); display: flex; gap: 8px; justify-content: center;';
                    
                    // 마커 추가/삭제 버튼 생성
                    if (hasUserMarker) {
                        const deleteBtn = document.createElement('button');
                        deleteBtn.className = 'custom-delete-marker-btn';
                        deleteBtn.innerHTML = `
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            <span>삭제</span>
                        `;
                        deleteBtn.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 8px 16px; background: #ffffff; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 6px; cursor: pointer; transition: all 0.3s ease; color: #000000; font-size: 13px; font-weight: 500;';
                        deleteBtn.title = '마커 삭제';
                        
                        deleteBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (existingUserMarker) {
                                existingUserMarker.setMap(null);
                                const index = currentMarkers.indexOf(existingUserMarker);
                                if (index > -1) {
                                    currentMarkers.splice(index, 1);
                                }
                                // 버튼을 추가 버튼으로 변경
                                controlsContainer.innerHTML = '';
                                const addBtn = createAddMarkerButton(placeName, placeLocation, controlsContainer, map);
                                controlsContainer.appendChild(addBtn);
                                console.log('✅ 마커가 삭제되었습니다.');
                            }
                        });
                        
                        deleteBtn.addEventListener('mouseenter', () => {
                            deleteBtn.style.background = '#f5f5f5';
                            deleteBtn.style.transform = 'scale(1.05)';
                        });
                        
                        deleteBtn.addEventListener('mouseleave', () => {
                            deleteBtn.style.background = '#ffffff';
                            deleteBtn.style.transform = 'scale(1)';
                        });
                        
                        controlsContainer.appendChild(deleteBtn);
                    } else {
                        const addBtn = createAddMarkerButton(placeName, placeLocation, controlsContainer, map);
                        controlsContainer.appendChild(addBtn);
                    }
                    
                    // InfoWindow 내용에 버튼 추가
                    infoWindowContainer.appendChild(controlsContainer);
                    console.log('✅ Google Maps InfoWindow에 버튼 추가:', placeName);
                }
            });
        };
        
        // 마커 추가 버튼 생성 함수
        const createAddMarkerButton = (placeName, placeLocation, container, map) => {
            const addBtn = document.createElement('button');
            addBtn.className = 'custom-add-marker-btn';
            
            // 좌표를 데이터 속성에 저장 (나중에 Places API로 업데이트 가능)
            if (placeLocation) {
                addBtn.dataset.placeLat = placeLocation.lat;
                addBtn.dataset.placeLng = placeLocation.lng;
            }
            addBtn.dataset.placeName = placeName;
            
            addBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>마커 추가</span>
            `;
            addBtn.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 8px 16px; background: rgba(78, 205, 196, 0.2); border: 1px solid rgba(78, 205, 196, 0.5); border-radius: 6px; cursor: pointer; transition: all 0.3s ease; color: #2d7d7a; font-size: 13px; font-weight: 500;';
            addBtn.title = '마커 추가';
            
            addBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                
                // 좌표 가져오기 (데이터 속성에서 우선, 없으면 placeLocation 사용)
                let markerLocation = placeLocation;
                if (addBtn.dataset.placeLat && addBtn.dataset.placeLng) {
                    markerLocation = {
                        lat: parseFloat(addBtn.dataset.placeLat),
                        lng: parseFloat(addBtn.dataset.placeLng)
                    };
                }
                
                // 좌표가 없으면 Places API로 검색
                if (!markerLocation && placeName && window.google && window.google.maps && window.google.maps.places) {
                    try {
                        const placesService = new google.maps.places.PlacesService(map);
                        const request = {
                            query: placeName,
                            fields: ['geometry', 'name']
                        };
                        
                        const result = await new Promise((resolve, reject) => {
                            placesService.textSearch(request, (results, status) => {
                                if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                                    const firstResult = results[0];
                                    if (firstResult.geometry && firstResult.geometry.location) {
                                        resolve({
                                            lat: firstResult.geometry.location.lat(),
                                            lng: firstResult.geometry.location.lng()
                                        });
                                    } else {
                                        reject(new Error('좌표를 찾을 수 없습니다'));
                                    }
                                } else {
                                    reject(new Error('장소를 찾을 수 없습니다'));
                                }
                            });
                        });
                        
                        markerLocation = result;
                        console.log('📍 Places API로 좌표 검색 완료:', markerLocation);
                    } catch (error) {
                        console.warn('Places API 검색 실패:', error);
                        alert('장소 위치를 찾을 수 없습니다. 다른 방법으로 시도해주세요.');
                        return;
                    }
                }
                
                if (!markerLocation) {
                    console.error('❌ 마커 위치를 찾을 수 없습니다.');
                    alert('장소 위치를 찾을 수 없습니다.');
                    return;
                }
                
                // 사용자 마커 생성
                const userMarker = new google.maps.Marker({
                    position: markerLocation,
                    map: map,
                    title: placeName,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 12,
                        fillColor: '#4ECDC4',
                        fillOpacity: 0.9,
                        strokeColor: '#FFFFFF',
                        strokeWeight: 2
                    },
                    animation: google.maps.Animation.DROP,
                    markerId: `user-marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                });
                
                // 마커에 장소 정보 저장 (나중에 클릭 시 사용)
                userMarker.placeName = placeName;
                userMarker.placeLocation = markerLocation;
                
                currentMarkers.push(userMarker);
                
                // 마커 클릭 시 InfoWindow 표시 (삭제 버튼만)
                const markerInfoWindow = new google.maps.InfoWindow();
                userMarker.addListener('click', () => {
                    const markerInfoContent = `
                        <div id="marker-info-${userMarker.markerId}" style="padding: 12px; min-width: 200px; font-family: 'Noto Sans KR', sans-serif; position: relative;">
                            <button 
                                id="delete-marker-btn-${userMarker.markerId}" 
                                class="info-window-delete-btn" 
                                style="position: absolute; top: 8px; right: 8px; background: #ffffff; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; color: #000000; padding: 0;"
                                title="마커 삭제"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #333; padding-right: 50px;">
                                📍 ${placeName}
                            </h3>
                            <p style="margin: 0 0 6px 0; font-size: 13px; color: #666;">
                                <strong>위도:</strong> ${markerLocation.lat.toFixed(6)}
                            </p>
                            <p style="margin: 0 0 6px 0; font-size: 13px; color: #666;">
                                <strong>경도:</strong> ${markerLocation.lng.toFixed(6)}
                            </p>
                        </div>
                    `;
                    
                    markerInfoWindow.close();
                    markerInfoWindow.setContent(markerInfoContent);
                    markerInfoWindow.open(map, userMarker);
                    
                    // InfoWindow가 DOM에 추가된 후 삭제 버튼 이벤트 리스너 추가
                    google.maps.event.addListenerOnce(markerInfoWindow, 'domready', () => {
                        const deleteBtn = document.getElementById(`delete-marker-btn-${userMarker.markerId}`);
                        if (deleteBtn) {
                            deleteBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                
                                // 마커 삭제
                                userMarker.setMap(null);
                                const index = currentMarkers.indexOf(userMarker);
                                if (index > -1) {
                                    currentMarkers.splice(index, 1);
                                }
                                
                                // InfoWindow 닫기
                                markerInfoWindow.close();
                                
                                // Google Maps 기본 InfoWindow가 열려있으면 버튼을 추가 버튼으로 변경
                                setTimeout(() => {
                                    checkAndInjectButtons();
                                }, 300);
                                
                                console.log('✅ 마커가 삭제되었습니다.');
                            });
                            
                            deleteBtn.addEventListener('mouseenter', () => {
                                deleteBtn.style.background = '#f5f5f5';
                                deleteBtn.style.transform = 'scale(1.1)';
                            });
                            
                            deleteBtn.addEventListener('mouseleave', () => {
                                deleteBtn.style.background = '#ffffff';
                                deleteBtn.style.transform = 'scale(1)';
                            });
                        }
                    });
                });
                
                // 버튼을 삭제 버튼으로 변경
                container.innerHTML = '';
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'custom-delete-marker-btn';
                deleteBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    <span>삭제</span>
                `;
                deleteBtn.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 8px 16px; background: #ffffff; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 6px; cursor: pointer; transition: all 0.3s ease; color: #000000; font-size: 13px; font-weight: 500;';
                deleteBtn.title = '마커 삭제';
                
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    userMarker.setMap(null);
                    const index = currentMarkers.indexOf(userMarker);
                    if (index > -1) {
                        currentMarkers.splice(index, 1);
                    }
                    // 버튼을 추가 버튼으로 변경
                    container.innerHTML = '';
                    const newAddBtn = createAddMarkerButton(placeName, placeLocation, container, map);
                    container.appendChild(newAddBtn);
                    console.log('✅ 마커가 삭제되었습니다.');
                });
                
                deleteBtn.addEventListener('mouseenter', () => {
                    deleteBtn.style.background = '#f5f5f5';
                    deleteBtn.style.transform = 'scale(1.05)';
                });
                
                deleteBtn.addEventListener('mouseleave', () => {
                    deleteBtn.style.background = '#ffffff';
                    deleteBtn.style.transform = 'scale(1)';
                });
                
                container.appendChild(deleteBtn);
                console.log('✅ 마커가 추가되었습니다.');
            });
            
            addBtn.addEventListener('mouseenter', () => {
                addBtn.style.background = 'rgba(78, 205, 196, 0.3)';
                addBtn.style.transform = 'scale(1.05)';
            });
            
            addBtn.addEventListener('mouseleave', () => {
                addBtn.style.background = 'rgba(78, 205, 196, 0.2)';
                addBtn.style.transform = 'scale(1)';
            });
            
            return addBtn;
        };
        
        // MutationObserver로 InfoWindow 추가 감지
        const observer = new MutationObserver(() => {
            checkAndInjectButtons();
        });
        
        // 주기적으로 체크 (InfoWindow가 늦게 로드될 수 있음)
        const checkInterval = setInterval(() => {
            checkAndInjectButtons();
        }, 500);
        
        // 지도 컨테이너와 body를 관찰
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // 지도 클릭 시에도 체크
        map.addListener('click', () => {
            setTimeout(() => {
                checkAndInjectButtons();
            }, 300);
        });
        
        // 지도 이동 시에도 체크 (InfoWindow가 열려있을 수 있음)
        map.addListener('idle', () => {
            checkAndInjectButtons();
        });
        
    } catch (error) {
        console.error('❌ 지도 초기화 중 오류 발생:', error);
        mapElement.innerHTML = '<div style="padding: 20px; text-align: center; color: #d32f2f;"><p>❌ 지도를 초기화하는 중 오류가 발생했습니다.</p><p>' + error.message + '</p></div>';
    }
}

// 장소 데이터를 로드하고 마커를 표시하는 함수
async function loadPlacesAndDisplayMarkers(map) {
    try {
        console.log('📂 장소 데이터를 로드하는 중...');
        
        // JSON 파일에서 장소 데이터 로드
        const response = await fetch('places-data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const places = await response.json();
        console.log(`✅ ${places.length}개의 장소 데이터를 로드했습니다.`);

        // InfoWindow 객체 생성 (한 번에 하나만 열리도록)
        const infoWindow = new google.maps.InfoWindow();

        // 각 장소에 대해 마커 생성
        places.forEach((place) => {
            const position = {
                lat: place.latitude,
                lng: place.longitude
            };

            // 마커 생성
            const marker = new google.maps.Marker({
                position: position,
                map: map,
                title: place.name,
                animation: google.maps.Animation.DROP
            });

            // InfoWindow 내용 생성
            const infoContent = `
                <div style="padding: 10px; min-width: 200px;">
                    <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #333;">
                        ${place.name}
                    </h3>
                    <p style="margin: 0 0 4px 0; font-size: 13px; color: #666;">
                        <strong>카테고리:</strong> ${place.category}
                    </p>
                    <p style="margin: 0 0 4px 0; font-size: 13px; color: #666;">
                        <strong>주소:</strong> ${place.address}
                    </p>
                    ${place.description ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #888; font-style: italic;">${place.description}</p>` : ''}
                </div>
            `;

            // 마커 클릭 이벤트 리스너
            marker.addListener('click', () => {
                // 기존에 열려있는 InfoWindow 닫기
                infoWindow.close();
                
                // 새로운 InfoWindow 열기
                infoWindow.setContent(infoContent);
                infoWindow.open(map, marker);
                
                console.log(`📍 마커 클릭: ${place.name}`);
            });
        });

        console.log('✅ 모든 마커가 성공적으로 표시되었습니다!');
        
    } catch (error) {
        console.error('❌ 장소 데이터 로드 중 오류 발생:', error);
        console.error('장소 데이터를 로드할 수 없습니다. places-data.json 파일을 확인하세요.');
    }
}

// 전역 변수: 마커 배열 (기존 마커 제거용)
let currentMarkers = [];

/**
 * 현재 위치를 가져와서 주변 독서 장소를 검색하고 마커로 표시하는 함수
 */
async function searchNearbyReadingPlaces() {
    const map = window.mapInstance;
    if (!map) {
        console.error('❌ 지도가 초기화되지 않았습니다.');
        alert('지도가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
        return;
    }

    // 기존 마커 제거
    clearMarkers();

    // 로딩 메시지 표시
    const nearbyPlacesBtn = document.getElementById('nearby-places-btn');
    if (nearbyPlacesBtn) {
        const originalText = nearbyPlacesBtn.querySelector('span')?.textContent || '주변 장소 추천';
        nearbyPlacesBtn.disabled = true;
        nearbyPlacesBtn.querySelector('span').textContent = '검색 중...';
    }

    try {
        // 1. 현재 위치 가져오기
        const position = await getCurrentPosition();
        const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };

        console.log('📍 현재 위치:', userLocation);

        // 지도 중심을 현재 위치로 이동 (panTo를 사용하여 부드럽게 이동)
        map.panTo(userLocation);
        map.setZoom(15);
        
        // 지도 중심 이동이 완료될 때까지 약간의 지연 후 마커 추가
        // 이렇게 하면 지도가 현재 위치로 이동한 후 마커가 표시됩니다
        await new Promise(resolve => setTimeout(resolve, 300));

        // 현재 위치 마커 추가
        const userMarker = new google.maps.Marker({
            position: userLocation,
            map: map,
            title: '내 위치',
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#4285F4',
                fillOpacity: 1,
                strokeColor: '#FFFFFF',
                strokeWeight: 2
            }
        });
        currentMarkers.push(userMarker);

        // 2. Places API로 주변 장소 검색
        const places = await searchPlacesNearby(map, userLocation);

        // 3. 검색된 장소를 마커로 표시
        displayPlaceMarkers(map, places);

        console.log(`✅ ${places.length}개의 주변 독서 장소를 찾았습니다.`);

        if (nearbyPlacesBtn) {
            nearbyPlacesBtn.disabled = false;
            nearbyPlacesBtn.querySelector('span').textContent = '주변 장소 추천';
        }

    } catch (error) {
        console.error('❌ 주변 장소 검색 오류:', error);
        alert('주변 장소를 검색하는 중 오류가 발생했습니다: ' + error.message);
        
        if (nearbyPlacesBtn) {
            nearbyPlacesBtn.disabled = false;
            nearbyPlacesBtn.querySelector('span').textContent = '주변 장소 추천';
        }
    }
}

/**
 * 책 속 장소 찾기 모달을 표시하는 함수
 * 읽은 책 목록을 기반으로 각 책과 관련된 장소 정보를 안내합니다.
 */
function showBookPlacesModal() {
    try {
        // 읽은 책 목록 가져오기
        const readBooks = getReadBooks();
        
        // 독서 기록에서도 책 정보 가져오기
        const readingRecords = JSON.parse(localStorage.getItem('readingRecords') || '[]');
        const booksFromRecords = readingRecords
            .map(record => record.bookTitle)
            .filter(title => title && title !== '책 정보 없음')
            .filter((title, index, self) => self.indexOf(title) === index); // 중복 제거
        
        // 모든 책 목록 합치기
        const allBooks = [...readBooks.map(book => book.title), ...booksFromRecords]
            .filter((title, index, self) => self.indexOf(title) === index); // 중복 제거
        
        if (allBooks.length === 0) {
            alert('읽은 책이 없습니다. 먼저 책을 읽어보세요!');
            return;
        }
        
        // 책별 관련 장소 정보 (데이터베이스)
        const bookPlacesData = {
            '1984': {
                title: '1984',
                author: 'George Orwell',
                places: [
                    {
                        name: '런던 (London)',
                        description: '소설의 배경이 되는 도시. 빅 브라더가 지배하는 전체주의 사회의 무대입니다.',
                        location: { lat: 51.5074, lng: -0.1278 },
                        type: '도시'
                    },
                    {
                        name: '빅토리아 역 (Victoria Station)',
                        description: '소설에서 언급되는 주요 장소 중 하나입니다.',
                        location: { lat: 51.4952, lng: -0.1441 },
                        type: '역사적 장소'
                    }
                ]
            },
            'Pride and Prejudice': {
                title: 'Pride and Prejudice',
                author: 'Jane Austen',
                places: [
                    {
                        name: '햄프셔 (Hampshire)',
                        description: '제인 오스틴이 태어나고 살았던 지역. 소설의 배경인 허트퍼드셔의 모델이 되었습니다.',
                        location: { lat: 51.0577, lng: -1.3080 },
                        type: '지역'
                    },
                    {
                        name: '롱본 (Longbourn)',
                        description: '소설에서 베넷 가족이 살던 집의 이름입니다.',
                        location: { lat: 51.0577, lng: -1.3080 },
                        type: '문학적 장소'
                    },
                    {
                        name: '펨벌리 (Pemberley)',
                        description: '다아시의 저택으로, 소설의 중요한 배경입니다.',
                        location: { lat: 53.2274, lng: -1.4200 },
                        type: '문학적 장소'
                    }
                ]
            },
            'The Great Gatsby': {
                title: 'The Great Gatsby',
                author: 'F. Scott Fitzgerald',
                places: [
                    {
                        name: '롱아일랜드 (Long Island)',
                        description: '소설의 주요 배경. 웨스트 에그와 이스트 에그가 있는 지역입니다.',
                        location: { lat: 40.7891, lng: -73.1350 },
                        type: '지역'
                    },
                    {
                        name: '뉴욕 (New York)',
                        description: '소설에서 중요한 장면들이 벌어지는 도시입니다.',
                        location: { lat: 40.7128, lng: -74.0060 },
                        type: '도시'
                    }
                ]
            },
            'To Kill a Mockingbird': {
                title: 'To Kill a Mockingbird',
                author: 'Harper Lee',
                places: [
                    {
                        name: '몽고메리 (Montgomery, Alabama)',
                        description: '하퍼 리가 태어나고 자란 도시. 소설의 배경인 메이콤의 모델입니다.',
                        location: { lat: 32.3668, lng: -86.3000 },
                        type: '도시'
                    },
                    {
                        name: '앨라배마 (Alabama)',
                        description: '소설의 배경이 되는 주입니다.',
                        location: { lat: 32.8067, lng: -86.7911 },
                        type: '주'
                    }
                ]
            }
        };
        
        // 모달 HTML 생성
        let modalContent = '';
        
        allBooks.forEach(bookTitle => {
            const bookData = bookPlacesData[bookTitle] || null;
            
            if (bookData && bookData.places && bookData.places.length > 0) {
                modalContent += `
                    <div class="book-places-section">
                        <div class="book-places-header">
                            <h4>${escapeHtml(bookData.title)}</h4>
                            <p class="book-author">${escapeHtml(bookData.author)}</p>
                        </div>
                        <div class="book-places-list">
                            ${bookData.places.map(place => `
                                <div class="book-place-item">
                                    <div class="place-info">
                                        <h5 class="place-name">${escapeHtml(place.name)}</h5>
                                        <span class="place-type">${escapeHtml(place.type)}</span>
                                        <p class="place-description">${escapeHtml(place.description)}</p>
                                    </div>
                                    ${place.location ? `
                                        <button type="button" class="place-map-btn" 
                                                data-lat="${place.location.lat}" 
                                                data-lng="${place.location.lng}"
                                                data-place-name="${escapeHtml(place.name)}">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                                <circle cx="12" cy="10" r="3"></circle>
                                            </svg>
                                            지도에서 보기
                                        </button>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            } else {
                // 관련 장소 정보가 없는 경우
                modalContent += `
                    <div class="book-places-section">
                        <div class="book-places-header">
                            <h4>${escapeHtml(bookTitle)}</h4>
                        </div>
                        <div class="book-places-list">
                            <p class="no-places-info">이 책과 관련된 장소 정보가 아직 등록되지 않았습니다.</p>
                        </div>
                    </div>
                `;
            }
        });
        
        if (!modalContent) {
            alert('읽은 책과 관련된 장소 정보를 찾을 수 없습니다.');
            return;
        }
        
        // 모달 HTML 생성
        const modalHTML = `
            <div id="book-places-modal" class="book-places-modal" style="display: flex;">
                <div class="modal-overlay"></div>
                <div class="modal-content book-places-modal-content">
                    <div class="modal-header">
                        <h3>📚 책 속 장소 찾기</h3>
                        <button type="button" class="modal-close-btn" id="book-places-modal-close" aria-label="닫기">×</button>
                    </div>
                    <div class="modal-body book-places-modal-body">
                        <p class="modal-intro">읽은 책과 관련된 실제 장소들을 확인해보세요.</p>
                        ${modalContent}
                    </div>
                </div>
            </div>
        `;
        
        // 기존 모달이 있으면 제거
        const existingModal = document.getElementById('book-places-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // 모달 추가
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 모달 닫기 버튼 이벤트
        const closeBtn = document.getElementById('book-places-modal-close');
        const modal = document.getElementById('book-places-modal');
        const overlay = modal?.querySelector('.modal-overlay');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (modal) modal.remove();
            });
        }
        
        if (overlay) {
            overlay.addEventListener('click', () => {
                if (modal) modal.remove();
            });
        }
        
        // 지도에서 보기 버튼 이벤트
        const mapButtons = modal?.querySelectorAll('.place-map-btn');
        if (mapButtons) {
            mapButtons.forEach(btn => {
                btn.addEventListener('click', function() {
                    const lat = parseFloat(this.getAttribute('data-lat'));
                    const lng = parseFloat(this.getAttribute('data-lng'));
                    const placeName = this.getAttribute('data-place-name');
                    
                    if (lat && lng && window.mapInstance) {
                        // 모달 닫기
                        if (modal) modal.remove();
                        
                        // 지도 페이지로 이동
                        showPage('map-page');
                        
                        // 지도 중심 이동 및 마커 표시
                        setTimeout(() => {
                            const location = new google.maps.LatLng(lat, lng);
                            window.mapInstance.setCenter(location);
                            window.mapInstance.setZoom(12);
                            
                            // 마커 추가
                            const marker = new google.maps.Marker({
                                position: location,
                                map: window.mapInstance,
                                title: placeName,
                                animation: google.maps.Animation.DROP
                            });
                            
                            // InfoWindow 추가
                            const infoWindow = new google.maps.InfoWindow({
                                content: `
                                    <div style="padding: 10px;">
                                        <h4 style="margin: 0 0 8px 0; font-size: 16px;">${escapeHtml(placeName)}</h4>
                                        <p style="margin: 0; color: #666; font-size: 14px;">책과 관련된 장소</p>
                                    </div>
                                `
                            });
                            
                            marker.addListener('click', () => {
                                infoWindow.open(window.mapInstance, marker);
                            });
                            
                            // 기존 마커 목록에 추가
                            if (window.currentMarkers) {
                                window.currentMarkers.push(marker);
                            }
                        }, 300);
                    }
                });
            });
        }
        
    } catch (error) {
        console.error('❌ 책 속 장소 찾기 오류:', error);
        alert('책 속 장소 정보를 불러오는 중 오류가 발생했습니다: ' + error.message);
    }
}

/**
 * 현재 위치를 가져오는 함수
 */
function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('이 브라우저는 위치 정보를 지원하지 않습니다.'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            resolve,
            (error) => {
                let errorMessage = '위치 정보를 가져올 수 없습니다.';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = '위치 정보 접근이 거부되었습니다. 브라우저 설정에서 위치 정보 접근을 허용해주세요.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = '위치 정보를 사용할 수 없습니다.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = '위치 정보 요청 시간이 초과되었습니다.';
                        break;
                }
                reject(new Error(errorMessage));
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

/**
 * Places API를 사용하여 주변 독서 장소를 검색하는 함수
 */
async function searchPlacesNearby(map, location) {
    return new Promise((resolve, reject) => {
        if (!window.google || !window.google.maps || !window.google.maps.places) {
            reject(new Error('Google Places API가 로드되지 않았습니다.'));
            return;
        }

        const service = new google.maps.places.PlacesService(map);
        const allPlaces = [];
        const searchTypes = [
            'book_store',      // 서점
            'library',         // 도서관
            'cafe'             // 카페 (북카페 포함)
        ];

        let completedSearches = 0;
        const totalSearches = searchTypes.length;

        searchTypes.forEach((type) => {
            const request = {
                location: location,
                radius: 2000, // 2km 반경
                type: type,
                keyword: type === 'cafe' ? '북카페 책' : undefined // 카페는 북카페 키워드 추가
            };

            service.nearbySearch(request, (results, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                    // 결과 필터링 (북카페인 경우)
                    const filteredResults = type === 'cafe' 
                        ? results.filter(place => 
                            place.name.toLowerCase().includes('북') || 
                            place.name.toLowerCase().includes('책') ||
                            place.name.toLowerCase().includes('book') ||
                            place.types.includes('book_store')
                          )
                        : results;

                    allPlaces.push(...filteredResults);
                    console.log(`✅ ${type} 검색 완료: ${filteredResults.length}개 장소 발견`);
                } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                    console.log(`ℹ️ ${type} 검색 결과 없음`);
                } else {
                    console.warn(`⚠️ ${type} 검색 오류:`, status);
                }

                completedSearches++;
                if (completedSearches === totalSearches) {
                    // 중복 제거 (같은 place_id를 가진 장소)
                    const uniquePlaces = [];
                    const seenPlaceIds = new Set();
                    
                    allPlaces.forEach(place => {
                        if (!seenPlaceIds.has(place.place_id)) {
                            seenPlaceIds.add(place.place_id);
                            uniquePlaces.push(place);
                        }
                    });

                    resolve(uniquePlaces);
                }
            });
        });
    });
}

/**
 * 검색된 장소를 지도에 마커로 표시하는 함수
 */
function displayPlaceMarkers(map, places) {
    const infoWindow = new google.maps.InfoWindow();

    places.forEach((place) => {
        // 장소 타입에 따라 다른 아이콘 사용
        let iconColor = '#FF6B6B'; // 기본 색상
        let iconType = '📚';

        if (place.types.includes('book_store')) {
            iconColor = '#4ECDC4';
            iconType = '📖';
        } else if (place.types.includes('library')) {
            iconColor = '#95E1D3';
            iconType = '📚';
        } else if (place.types.includes('cafe')) {
            iconColor = '#F38181';
            iconType = '☕';
        }

        // 마커 생성
        const marker = new google.maps.Marker({
            position: place.geometry.location,
            map: map,
            title: place.name,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: iconColor,
                fillOpacity: 0.9,
                strokeColor: '#FFFFFF',
                strokeWeight: 2
            },
            animation: google.maps.Animation.DROP
        });

        currentMarkers.push(marker);

        // InfoWindow 내용 생성 (고유 ID 추가)
        const placeInfoId = `place-info-${place.place_id || Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const placeLocation = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
        };
        
        // 해당 위치에 이미 사용자 추가 마커가 있는지 확인
        const existingUserMarker = currentMarkers.find(m => {
            if (!m.markerId || !m.markerId.startsWith('user-marker-')) return false;
            const pos = m.getPosition();
            return pos && Math.abs(pos.lat() - placeLocation.lat) < 0.0001 && 
                   Math.abs(pos.lng() - placeLocation.lng) < 0.0001;
        });
        
        const hasUserMarker = !!existingUserMarker;
        
        const infoContent = `
            <div id="${placeInfoId}" style="padding: 12px; min-width: 200px; font-family: 'Noto Sans KR', sans-serif; position: relative;">
                ${hasUserMarker ? `
                    <button 
                        id="delete-user-marker-btn-${placeInfoId}" 
                        class="info-window-delete-btn" 
                        style="position: absolute; top: 8px; right: 8px; background: #ffffff; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; color: #000000; padding: 0;"
                        title="마커 삭제"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                ` : `
                    <button 
                        id="add-marker-btn-${placeInfoId}" 
                        class="info-window-add-marker-btn" 
                        style="position: absolute; top: 8px; right: 8px; background: rgba(78, 205, 196, 0.2); border: 1px solid rgba(78, 205, 196, 0.5); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; color: #2d7d7a; padding: 0;"
                        title="마커 추가"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                `}
                <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #333; padding-right: 80px;">
                    ${iconType} ${place.name}
                </h3>
                <p style="margin: 0 0 6px 0; font-size: 13px; color: #666;">
                    <strong>주소:</strong> ${place.vicinity || '주소 정보 없음'}
                </p>
                ${place.rating ? `
                    <p style="margin: 0 0 6px 0; font-size: 13px; color: #666;">
                        <strong>평점:</strong> ⭐ ${place.rating} (${place.user_ratings_total || 0}개 리뷰)
                    </p>
                ` : ''}
                ${place.types ? `
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #888;">
                        ${place.types.filter(t => !t.includes('point_of_interest') && !t.includes('establishment')).slice(0, 2).join(', ')}
                    </p>
                ` : ''}
            </div>
        `;

        // 마커 클릭 이벤트
        marker.addListener('click', () => {
            infoWindow.close();
            
            // 현재 상태에 맞는 InfoWindow 내용 생성
            const currentPlaceLocation = {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng()
            };
            const currentExistingUserMarker = currentMarkers.find(m => {
                if (!m.markerId || !m.markerId.startsWith('user-marker-')) return false;
                const pos = m.getPosition();
                return pos && Math.abs(pos.lat() - currentPlaceLocation.lat) < 0.0001 && 
                       Math.abs(pos.lng() - currentPlaceLocation.lng) < 0.0001;
            });
            const currentHasUserMarker = !!currentExistingUserMarker;
            
            // 동적으로 InfoWindow 내용 업데이트
            // 마커 클릭 시에는 마커가 있으면 삭제 버튼만, 없으면 버튼 없음 (마커 추가는 장소 클릭 시에만)
            const updatedInfoContent = `
                <div id="${placeInfoId}" style="padding: 12px; min-width: 200px; font-family: 'Noto Sans KR', sans-serif; position: relative;">
                    ${currentHasUserMarker ? `
                        <button 
                            id="delete-user-marker-btn-${placeInfoId}" 
                            class="info-window-delete-btn" 
                            style="position: absolute; top: 8px; right: 8px; background: #ffffff; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; color: #000000; padding: 0;"
                            title="마커 삭제"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    ` : ''}
                    <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #333; padding-right: ${currentHasUserMarker ? '50px' : '0'};">
                        ${iconType} ${place.name}
                    </h3>
                    <p style="margin: 0 0 6px 0; font-size: 13px; color: #666;">
                        <strong>주소:</strong> ${place.vicinity || '주소 정보 없음'}
                    </p>
                    ${place.rating ? `
                        <p style="margin: 0 0 6px 0; font-size: 13px; color: #666;">
                            <strong>평점:</strong> ⭐ ${place.rating} (${place.user_ratings_total || 0}개 리뷰)
                        </p>
                    ` : ''}
                    ${place.types ? `
                        <p style="margin: 0 0 8px 0; font-size: 12px; color: #888;">
                            ${place.types.filter(t => !t.includes('point_of_interest') && !t.includes('establishment')).slice(0, 2).join(', ')}
                        </p>
                    ` : ''}
                </div>
            `;
            
            infoWindow.setContent(updatedInfoContent);
            infoWindow.open(map, marker);
            
            // 사이드바에 장소 정보 추가
            addPlaceToSidebar(place);
            
            // InfoWindow가 DOM에 추가된 후 버튼 이벤트 리스너 추가
            google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
                // 마커 추가/삭제 버튼 이벤트 리스너 설정 함수
                const setupMarkerButtons = () => {
                    // 마커 추가 버튼
                    const addMarkerBtn = document.getElementById(`add-marker-btn-${placeInfoId}`);
                    if (addMarkerBtn) {
                        // 기존 이벤트 리스너 제거 (중복 방지)
                        const newAddBtn = addMarkerBtn.cloneNode(true);
                        addMarkerBtn.parentNode.replaceChild(newAddBtn, addMarkerBtn);
                        
                        newAddBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            
                            // 사용자 마커 생성
                            const userMarker = new google.maps.Marker({
                                position: place.geometry.location,
                                map: map,
                                title: place.name,
                                icon: {
                                    path: google.maps.SymbolPath.CIRCLE,
                                    scale: 12,
                                    fillColor: '#4ECDC4',
                                    fillOpacity: 0.9,
                                    strokeColor: '#FFFFFF',
                                    strokeWeight: 2
                                },
                                animation: google.maps.Animation.DROP,
                                markerId: `user-marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                            });
                            
                            // 마커에 장소 정보 저장
                            userMarker.placeName = place.name;
                            userMarker.placeLocation = {
                                lat: place.geometry.location.lat(),
                                lng: place.geometry.location.lng()
                            };
                            userMarker.placeData = place;
                            
                            currentMarkers.push(userMarker);
                            
                            // 마커 클릭 시 InfoWindow 표시 (삭제 버튼만)
                            const markerInfoWindow = new google.maps.InfoWindow();
                            userMarker.addListener('click', () => {
                                const markerInfoContent = `
                                    <div id="marker-info-${userMarker.markerId}" style="padding: 12px; min-width: 200px; font-family: 'Noto Sans KR', sans-serif; position: relative;">
                                        <button 
                                            id="delete-marker-btn-${userMarker.markerId}" 
                                            class="info-window-delete-btn" 
                                            style="position: absolute; top: 8px; right: 8px; background: #ffffff; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; color: #000000; padding: 0;"
                                            title="마커 삭제"
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                        </button>
                                        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #333; padding-right: 50px;">
                                            ${iconType} ${place.name}
                                        </h3>
                                        <p style="margin: 0 0 6px 0; font-size: 13px; color: #666;">
                                            <strong>주소:</strong> ${place.vicinity || '주소 정보 없음'}
                                        </p>
                                        ${place.rating ? `
                                            <p style="margin: 0 0 6px 0; font-size: 13px; color: #666;">
                                                <strong>평점:</strong> ⭐ ${place.rating} (${place.user_ratings_total || 0}개 리뷰)
                                            </p>
                                        ` : ''}
                                    </div>
                                `;
                                
                                markerInfoWindow.close();
                                markerInfoWindow.setContent(markerInfoContent);
                                markerInfoWindow.open(map, userMarker);
                                
                                // InfoWindow가 DOM에 추가된 후 삭제 버튼 이벤트 리스너 추가
                                google.maps.event.addListenerOnce(markerInfoWindow, 'domready', () => {
                                    const deleteBtn = document.getElementById(`delete-marker-btn-${userMarker.markerId}`);
                                    if (deleteBtn) {
                                        deleteBtn.addEventListener('click', (e) => {
                                            e.stopPropagation();
                                            
                                            // 마커 삭제
                                            userMarker.setMap(null);
                                            const index = currentMarkers.indexOf(userMarker);
                                            if (index > -1) {
                                                currentMarkers.splice(index, 1);
                                            }
                                            
                                            // InfoWindow 닫기
                                            markerInfoWindow.close();
                                            
                                            // Places API 마커의 InfoWindow 업데이트 (추가 버튼으로 변경)
                                            updatePlaceInfoWindow(marker, place, placeInfoId, false, null);
                                            
                                            console.log('✅ 마커가 삭제되었습니다.');
                                        });
                                        
                                        deleteBtn.addEventListener('mouseenter', () => {
                                            deleteBtn.style.background = '#f5f5f5';
                                            deleteBtn.style.transform = 'scale(1.1)';
                                        });
                                        
                                        deleteBtn.addEventListener('mouseleave', () => {
                                            deleteBtn.style.background = '#ffffff';
                                            deleteBtn.style.transform = 'scale(1)';
                                        });
                                    }
                                });
                            });
                            
                            // InfoWindow 업데이트 (삭제 버튼으로 변경)
                            updatePlaceInfoWindow(marker, place, placeInfoId, true, userMarker);
                            
                            console.log('✅ 마커가 추가되었습니다.');
                        });
                        
                        // 호버 효과
                        newAddBtn.addEventListener('mouseenter', () => {
                            newAddBtn.style.background = 'rgba(78, 205, 196, 0.3)';
                            newAddBtn.style.transform = 'scale(1.1)';
                        });
                        
                        newAddBtn.addEventListener('mouseleave', () => {
                            newAddBtn.style.background = 'rgba(78, 205, 196, 0.2)';
                            newAddBtn.style.transform = 'scale(1)';
                        });
                    }
                    
                    // 마커 삭제 버튼
                    const deleteMarkerBtn = document.getElementById(`delete-user-marker-btn-${placeInfoId}`);
                    if (deleteMarkerBtn) {
                        // 기존 이벤트 리스너 제거 (중복 방지)
                        const newDeleteBtn = deleteMarkerBtn.cloneNode(true);
                        deleteMarkerBtn.parentNode.replaceChild(newDeleteBtn, deleteMarkerBtn);
                        
                        // 현재 위치의 사용자 마커 찾기
                        const placeLocation = {
                            lat: place.geometry.location.lat(),
                            lng: place.geometry.location.lng()
                        };
                        const existingUserMarker = currentMarkers.find(m => {
                            if (!m.markerId || !m.markerId.startsWith('user-marker-')) return false;
                            const pos = m.getPosition();
                            return pos && Math.abs(pos.lat() - placeLocation.lat) < 0.0001 && 
                                   Math.abs(pos.lng() - placeLocation.lng) < 0.0001;
                        });
                        
                        if (existingUserMarker) {
                            newDeleteBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                
                                // 마커 제거
                                existingUserMarker.setMap(null);
                                const index = currentMarkers.indexOf(existingUserMarker);
                                if (index > -1) {
                                    currentMarkers.splice(index, 1);
                                }
                                
                                // InfoWindow 업데이트 (추가 버튼으로 변경)
                                updatePlaceInfoWindow(marker, place, placeInfoId, false, null);
                                
                                console.log('✅ 마커가 삭제되었습니다.');
                            });
                            
                            // 호버 효과
                            newDeleteBtn.addEventListener('mouseenter', () => {
                                newDeleteBtn.style.background = '#f5f5f5';
                                newDeleteBtn.style.transform = 'scale(1.1)';
                            });
                            
                            newDeleteBtn.addEventListener('mouseleave', () => {
                                newDeleteBtn.style.background = '#ffffff';
                                newDeleteBtn.style.transform = 'scale(1)';
                            });
                        }
                    }
                };
                
                // InfoWindow 업데이트 함수 (먼저 정의)
                const updatePlaceInfoWindow = (targetMarker, placeData, infoId, hasUserMarker, userMarkerRef) => {
                    const savedPlaces = JSON.parse(localStorage.getItem('savedPlaces') || '[]');
                    const isSaved = savedPlaces.some(p => p.placeId === placeData.place_id);
                    
                    const updatedContent = `
                        <div id="${infoId}" style="padding: 12px; min-width: 200px; font-family: 'Noto Sans KR', sans-serif; position: relative;">
                            ${hasUserMarker ? `
                                <button 
                                    id="delete-user-marker-btn-${infoId}" 
                                    class="info-window-delete-btn" 
                                    style="position: absolute; top: 8px; right: 8px; background: #ffffff; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; color: #000000; padding: 0;"
                                    title="마커 삭제"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                            ` : `
                                <button 
                                    id="add-marker-btn-${infoId}" 
                                    class="info-window-add-marker-btn" 
                                    style="position: absolute; top: 8px; right: 8px; background: rgba(78, 205, 196, 0.2); border: 1px solid rgba(78, 205, 196, 0.5); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; color: #2d7d7a; padding: 0;"
                                    title="마커 추가"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                </button>
                            `}
                            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #333; padding-right: 80px;">
                                ${iconType} ${placeData.name}
                            </h3>
                            <p style="margin: 0 0 6px 0; font-size: 13px; color: #666;">
                                <strong>주소:</strong> ${placeData.vicinity || '주소 정보 없음'}
                            </p>
                            ${placeData.rating ? `
                                <p style="margin: 0 0 6px 0; font-size: 13px; color: #666;">
                                    <strong>평점:</strong> ⭐ ${placeData.rating} (${placeData.user_ratings_total || 0}개 리뷰)
                                </p>
                            ` : ''}
                            ${placeData.types ? `
                                <p style="margin: 0 0 8px 0; font-size: 12px; color: #888;">
                                    ${placeData.types.filter(t => !t.includes('point_of_interest') && !t.includes('establishment')).slice(0, 2).join(', ')}
                                </p>
                            ` : ''}
                        </div>
                    `;
                    
                    infoWindow.setContent(updatedContent);
                    infoWindow.open(map, targetMarker);
                    
                    // 버튼 이벤트 리스너 추가
                    google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
                        // 마커 추가/삭제 버튼 이벤트
                        setupMarkerButtons();
                    });
                };
                
                // 초기 버튼 설정
                setupMarkerButtons();
                
                // 삭제 버튼 이벤트 리스너 (이미 마커가 있는 경우)
                const deleteUserMarkerBtn = document.getElementById(`delete-user-marker-btn-${placeInfoId}`);
                if (deleteUserMarkerBtn && currentExistingUserMarker) {
                    deleteUserMarkerBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        currentExistingUserMarker.setMap(null);
                        const index = currentMarkers.indexOf(currentExistingUserMarker);
                        if (index > -1) {
                            currentMarkers.splice(index, 1);
                        }
                        
                        // InfoWindow 내용을 마커 추가 버튼으로 변경
                        const restoredContent = `
                            <div id="${placeInfoId}" style="padding: 12px; min-width: 200px; font-family: 'Noto Sans KR', sans-serif; position: relative;">
                                <button 
                                    id="add-marker-btn-${placeInfoId}" 
                                    class="info-window-add-marker-btn" 
                                    style="position: absolute; top: 8px; right: 8px; background: rgba(78, 205, 196, 0.2); border: 1px solid rgba(78, 205, 196, 0.5); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; color: #2d7d7a; padding: 0;"
                                    title="마커 추가"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                </button>
                                <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #333; padding-right: 80px;">
                                    ${iconType} ${place.name}
                                </h3>
                                <p style="margin: 0 0 6px 0; font-size: 13px; color: #666;">
                                    <strong>주소:</strong> ${place.vicinity || '주소 정보 없음'}
                                </p>
                                ${place.rating ? `
                                    <p style="margin: 0 0 6px 0; font-size: 13px; color: #666;">
                                        <strong>평점:</strong> ⭐ ${place.rating} (${place.user_ratings_total || 0}개 리뷰)
                                    </p>
                                ` : ''}
                                ${place.types ? `
                                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #888;">
                                        ${place.types.filter(t => !t.includes('point_of_interest') && !t.includes('establishment')).slice(0, 2).join(', ')}
                                    </p>
                                ` : ''}
                            </div>
                        `;
                        
                        infoWindow.setContent(restoredContent);
                        infoWindow.open(map, marker);
                        
                        // 마커 추가 버튼 이벤트 리스너 다시 추가
                        google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
                            const newAddMarkerBtn = document.getElementById(`add-marker-btn-${placeInfoId}`);
                            if (newAddMarkerBtn) {
                                // 마커 추가 로직은 위의 addMarkerBtn 이벤트 리스너와 동일
                                newAddMarkerBtn.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    // 위의 마커 추가 로직과 동일한 코드를 여기에 추가해야 하지만,
                                    // 중복을 피하기 위해 함수로 추출하는 것이 좋습니다.
                                    // 일단 간단하게 처리
                                });
                            }
                        });
                        
                        console.log('✅ 마커가 삭제되었습니다.');
                    });
                    
                    deleteUserMarkerBtn.addEventListener('mouseenter', () => {
                        deleteUserMarkerBtn.style.background = '#f5f5f5';
                        deleteUserMarkerBtn.style.transform = 'scale(1.1)';
                    });
                    
                    deleteUserMarkerBtn.addEventListener('mouseleave', () => {
                        deleteUserMarkerBtn.style.background = '#ffffff';
                        deleteUserMarkerBtn.style.transform = 'scale(1)';
                    });
                }
            });
        });
    });
}

/**
 * InfoWindow에서 장소를 저장하는 함수
 */
function savePlaceFromInfoWindow(place, saveBtn) {
    try {
        const savedPlaces = JSON.parse(localStorage.getItem('savedPlaces') || '[]');
        
        // 이미 저장된 장소인지 확인
        const existingIndex = savedPlaces.findIndex(p => p.placeId === place.place_id);
        
        if (existingIndex !== -1) {
            // 이미 저장된 경우 제거
            savedPlaces.splice(existingIndex, 1);
            localStorage.setItem('savedPlaces', JSON.stringify(savedPlaces));
            
            // 버튼 상태 변경
            saveBtn.style.background = 'rgba(196, 201, 168, 0.3)';
            saveBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
            `;
            saveBtn.title = '내 장소에 저장';
            
            console.log('✅ 장소가 저장 목록에서 제거되었습니다:', place.name);
            
            // 저장된 장소 목록이 표시 중이면 업데이트
            if (typeof loadSavedPlaces === 'function') {
                loadSavedPlaces();
            }
        } else {
            // 새로 저장
            const newPlace = {
                id: Date.now().toString(),
                placeId: place.place_id,
                name: place.name,
                address: place.vicinity || place.formatted_address || '주소 정보 없음',
                description: '',
                latitude: place.geometry.location.lat(),
                longitude: place.geometry.location.lng(),
                rating: place.rating || null,
                user_ratings_total: place.user_ratings_total || 0,
                types: place.types || [],
                visibility: 'private',
                savedAt: new Date().toISOString()
            };
            
            savedPlaces.unshift(newPlace);
            localStorage.setItem('savedPlaces', JSON.stringify(savedPlaces));
            
            // 버튼 상태 변경
            saveBtn.style.background = 'rgba(196, 201, 168, 0.6)';
            saveBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            saveBtn.title = '저장됨';
            
            console.log('✅ 장소가 저장되었습니다:', place.name);
            
            // 저장된 장소 목록이 표시 중이면 업데이트
            if (typeof loadSavedPlaces === 'function') {
                loadSavedPlaces();
            }
        }
    } catch (error) {
        console.error('❌ 장소 저장 오류:', error);
        alert('장소를 저장하는 중 오류가 발생했습니다.');
    }
}

/**
 * 사이드바에 장소 정보를 추가하는 함수
 * @param {Object} place - Google Places API 장소 객체
 */
function addPlaceToSidebar(place) {
    try {
        const placesList = document.getElementById('places-list');
        if (!placesList) {
            console.warn('⚠️ 사이드바 places-list를 찾을 수 없습니다.');
            return;
        }

        // 중복 체크: 같은 place_id가 이미 있는지 확인
        const existingPlace = placesList.querySelector(`[data-place-id="${place.place_id}"]`);
        if (existingPlace) {
            console.log('ℹ️ 이미 사이드바에 추가된 장소입니다:', place.name);
            // 이미 있는 장소로 스크롤
            existingPlace.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            // 하이라이트 효과
            existingPlace.style.background = 'rgba(196, 201, 168, 0.3)';
            setTimeout(() => {
                existingPlace.style.background = '';
            }, 2000);
            return;
        }

        // 장소 주소 가져오기
        const address = place.vicinity || place.formatted_address || '주소 정보 없음';

        // 장소 아이템 HTML 생성
        const placeItem = document.createElement('article');
        placeItem.className = 'place-item';
        placeItem.setAttribute('data-place-id', place.place_id);
        placeItem.innerHTML = `
            <div class="place-info">
                <h5 class="place-name">${place.name}</h5>
                <p class="place-address">${address}</p>
            </div>
            <button type="button" class="place-record-btn" data-place-id="${place.place_id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                <span>이곳에서 독서 기록 남기기</span>
            </button>
        `;

        // 목록의 맨 위에 추가
        placesList.insertBefore(placeItem, placesList.firstChild);

        // 10개를 초과하면 가장 오래된 장소(맨 밑) 제거
        const placeItems = placesList.querySelectorAll('.place-item');
        if (placeItems.length > 10) {
            // 가장 마지막(오래된) 장소 제거
            const oldestPlace = Array.from(placeItems).pop(); // 마지막 요소 가져오기
            if (oldestPlace) {
                oldestPlace.remove();
                console.log('ℹ️ 장소 개수가 10개를 초과하여 가장 오래된 장소를 제거했습니다.');
            }
        }

        // '추천 장소' 탭 활성화
        const recommendedTab = document.querySelector('.sidebar-tab-btn[data-tab="recommended"]');
        const savedTab = document.querySelector('.sidebar-tab-btn[data-tab="saved"]');
        const savedPlacesList = document.getElementById('saved-places-list');
        
        if (recommendedTab && savedTab) {
            recommendedTab.classList.add('active');
            savedTab.classList.remove('active');
        }
        
        if (placesList) placesList.style.display = 'flex';
        if (savedPlacesList) savedPlacesList.style.display = 'none';

        // 이벤트 위임으로 이미 처리되므로 여기서는 추가 이벤트 리스너를 등록하지 않음
        // (이벤트 위임은 DOMContentLoaded에서 이미 설정됨)

        // 추가된 장소로 부드럽게 스크롤
        setTimeout(() => {
            placeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            // 하이라이트 효과
            placeItem.style.background = 'rgba(196, 201, 168, 0.3)';
            setTimeout(() => {
                placeItem.style.background = '';
            }, 2000);
        }, 100);

        console.log('✅ 사이드바에 장소 추가 완료:', place.name);
    } catch (error) {
        console.error('❌ 사이드바에 장소 추가 오류:', error);
    }
}

/**
 * 기존 마커를 모두 제거하는 함수
 */
function clearMarkers() {
    currentMarkers.forEach(marker => {
        marker.setMap(null);
    });
    currentMarkers = [];
}

// initMap 함수를 전역 스코프에 노출 (Google Maps API 콜백용)
window.initMap = initMap;

// ============================================
// Spotify Web Playback SDK
// ============================================

// Spotify 플레이어 전역 변수
let spotifyPlayer = null;
let spotifyDeviceId = null;
let isInitializingPlayer = false; // 플레이어 초기화 중 플래그
let spotifyPlayQueue = []; // 재생 요청 큐 (플레이어가 ready 상태가 아닐 때 재생 요청을 저장)
// Spotify Access Token 전역 변수 (SDK 로드 완료 후 플레이어 초기화에 사용)
window.spotifyAccessToken = null;
let spotifyPlayerState = {
    isPlaying: false,
    currentTrack: null,
    position: 0,
    duration: 0,
    volume: 0.5
};

/**
 * Spotify Web Playback SDK 플레이어 초기화
 * @param {string} token - Spotify Access Token
 */
async function initSpotifyPlayer(token) {
    // 이미 초기화 중이면 중복 실행 방지
    if (isInitializingPlayer) {
        console.log('⚠️ 플레이어 초기화가 이미 진행 중입니다.');
        return;
    }
    
    // 이미 플레이어가 초기화되어 있고 deviceId가 있으면 재초기화 불필요
    if (window.spotifyPlayer && window.spotifyDeviceId) {
        console.log('✅ 플레이어가 이미 초기화되어 있습니다.');
        return;
    }
    
    isInitializingPlayer = true;
    
    try {
        // Spotify Web Playback SDK가 로드되었는지 확인
        if (!window.Spotify) {
            console.warn('⚠️ window.Spotify가 없습니다. SDK 로드 상태 확인 중...');
            console.log('  - window.spotifySDKReady:', window.spotifySDKReady);
            console.log('  - window.Spotify 타입:', typeof window.Spotify);
            
            // spotifySDKReady 플래그 확인
            if (window.spotifySDKReady) {
                console.log('⚠️ SDK 플래그는 설정되었지만 window.Spotify가 없습니다. SDK 할당을 기다립니다...');
                
                // SDK 할당을 기다림 (최대 5초)
                let attempts = 0;
                const maxAttempts = 50; // 5초 (100ms * 50)
                
                while (!window.Spotify && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                    if (attempts % 10 === 0) {
                        console.log(`  대기 중... (${attempts * 100}ms)`);
                    }
                }
            } else {
                // SDK가 아직 로드되지 않은 경우 대기
                console.log('⚠️ SDK가 아직 로드되지 않았습니다. SDK 로드를 기다립니다...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // 최종 확인
            if (!window.Spotify) {
                console.error('❌ Spotify Web Playback SDK가 로드되지 않았습니다.');
                console.error('  - window.Spotify:', window.Spotify);
                console.error('  - window.spotifySDKReady:', window.spotifySDKReady);
                console.error('  - onSpotifyWebPlaybackSDKReady 함수:', typeof window.onSpotifyWebPlaybackSDKReady);
                throw new Error('Spotify Web Playback SDK가 로드되지 않았습니다. 페이지를 새로고침해주세요.');
            }
            
            console.log('✅ window.Spotify 확인 완료:', typeof window.Spotify);
        } else {
            console.log('✅ window.Spotify 확인 완료:', typeof window.Spotify);
        }

        // 이미 플레이어가 초기화되어 있다면 제거
        if (spotifyPlayer) {
            await spotifyPlayer.disconnect();
            spotifyPlayer = null;
            window.spotifyPlayer = null;
        }

        // 새로운 Spotify Player 인스턴스 생성
        spotifyPlayer = new window.Spotify.Player({
            name: 'LitConnect Web Player',
            getOAuthToken: cb => {
                // 토큰을 콜백으로 전달
                cb(token);
            },
            volume: spotifyPlayerState.volume
        });

        // window 객체에 할당 (전역 접근을 위해)
        window.spotifyPlayer = spotifyPlayer;

        // 플레이어 준비 완료를 기다리는 Promise 생성
        const playerReady = new Promise((resolve, reject) => {
            // 플레이어 준비 완료 이벤트
            // Spotify Web Playback SDK의 ready 이벤트는 { device_id } 형태로 전달됩니다
            spotifyPlayer.addListener('ready', async ({ device_id }) => {
                // ============================================
                // device_id 추출 및 검증 (가장 먼저 실행)
                // ============================================
                console.log("========================================");
                console.log("DEBUG: Ready Event 발생");
                console.log("========================================");
                console.log("DEBUG: Device ID (구조 분해 할당):", device_id);
                console.log("DEBUG: Device ID 타입:", typeof device_id);
                
                // device_id 유효성 검증
                if (!device_id || typeof device_id !== 'string' || device_id.trim() === '') {
                    console.error('❌ device_id가 유효하지 않습니다.');
                    console.error('  - device_id 값:', device_id);
                    console.error('  - device_id 타입:', typeof device_id);
                    console.error('  - device_id 존재:', !!device_id);
                    reject(new Error('device_id를 추출할 수 없습니다.'));
                    return;
                }
                
                console.log('✅ Spotify 플레이어가 준비되었습니다.');
                console.log('✅ Device ID 유효성 검증 통과:', {
                    존재: !!device_id,
                    타입: typeof device_id,
                    길이: device_id.length,
                    값: device_id
                });
                
                // 전역 변수에 device_id 저장
                spotifyDeviceId = device_id;
                // window 객체에 할당 (전역 접근을 위해)
                window.spotifyDeviceId = device_id;
                // 추가 전역 변수에도 저장 (window.deviceId)
                window.deviceId = device_id;
                
                // 저장된 값 확인
                console.log('✅ Device ID 전역 변수 저장 완료:');
                console.log('  - spotifyDeviceId:', spotifyDeviceId);
                console.log('  - window.spotifyDeviceId:', window.spotifyDeviceId);
                console.log('  - window.deviceId:', window.deviceId);
                console.log("========================================");
                
                try {
                    // 플레이어 활성화 시도 (activateElement 메서드가 있는 경우)
                    if (typeof spotifyPlayer.activateElement === 'function') {
                        console.log('🔄 플레이어 활성화 시도 (activateElement)...');
                        await spotifyPlayer.activateElement();
                        console.log('✅ 플레이어 활성화 완료');
                    } else if (typeof spotifyPlayer.setDeviceId === 'function') {
                        console.log('🔄 플레이어 디바이스 ID 설정 (setDeviceId)...');
                        spotifyPlayer.setDeviceId(device_id);
                        console.log('✅ 플레이어 디바이스 ID 설정 완료');
                    }
                    
                    // 현재 활성화된 디바이스를 새로 생성된 LitConnect 플레이어 디바이스로 전환
                    // 전역 변수에서 device_id 사용
                    const accessToken = getSpotifyToken();
                    const currentDeviceId = window.deviceId || window.spotifyDeviceId || device_id;
                    
                    if (accessToken && currentDeviceId) {
                        console.log('🔄 재생 디바이스를 LitConnect 플레이어로 전환 중...');
                        console.log('DEBUG: Transfer Playback에 사용할 Device ID:', currentDeviceId);
                        
                        const transferResponse = await fetch('https://api.spotify.com/v1/me/player', {
                            method: 'PUT',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                device_ids: [currentDeviceId],
                                play: false // 전환만 하고 자동 재생하지 않음
                            })
                        });
                        
                        if (transferResponse.ok) {
                            console.log('✅ 재생 디바이스 전환 완료');
                            console.log('✅ 사용된 Device ID:', currentDeviceId);
                        } else {
                            const errorData = await transferResponse.json().catch(() => ({}));
                            console.warn('⚠️ 디바이스 전환 실패 (계속 진행):', errorData.error?.message || transferResponse.statusText);
                            console.warn('⚠️ 사용된 Device ID:', currentDeviceId);
                            // 디바이스 전환 실패해도 계속 진행
                        }
                    } else {
                        console.warn('⚠️ 디바이스 전환을 위한 Access Token 또는 Device ID가 없습니다.');
                        console.warn('  - Access Token:', accessToken ? '있음' : '없음');
                        console.warn('  - Device ID:', currentDeviceId || '없음');
                    }
                } catch (error) {
                    console.warn('⚠️ 플레이어 활성화/전환 중 오류 (계속 진행):', error);
                    // 활성화 실패해도 계속 진행
                }
                
                // 플레이어 준비 완료를 UI에 알림
                updatePlayerUI('ready');
                
                // 재생 버튼이 활성화되었음을 확인
                console.log('✅ 재생 버튼이 활성화되었습니다. 이제 음악을 재생할 수 있습니다.');
                
                // 플레이어가 성공적으로 초기화되었으므로 "플레이어가 준비 중입니다" 메시지 제거
                // (alert는 이미 표시되지 않도록 수정했으므로 추가 작업 불필요)
                // 큐에 저장된 재생 요청이 있으면 순차적으로 실행
                if (spotifyPlayQueue.length > 0) {
                    console.log(`📋 큐에 저장된 재생 요청 ${spotifyPlayQueue.length}개를 처리합니다.`);
                    // 비동기로 실행 (Promise resolve를 블로킹하지 않음)
                    processPlayQueue().catch(error => {
                        console.error('❌ 재생 큐 처리 중 오류:', error);
                    });
                }
                
                resolve(device_id);
            });

            // 플레이어 인증 오류 이벤트
            spotifyPlayer.addListener('authentication_error', (error) => {
                console.error('========================================');
                console.error('❌ Spotify 플레이어 인증 오류 발생');
                console.error('========================================');
                
                // 오류 객체 상세 정보 출력
                if (error) {
                    console.error('오류 객체:', error);
                    console.error('오류 메시지:', error.message || '메시지 없음');
                    console.error('오류 타입:', typeof error);
                    console.error('오류 키:', Object.keys(error || {}));
                    
                    // error 객체의 모든 속성 출력
                    if (typeof error === 'object') {
                        console.error('오류 상세 정보:');
                        for (const key in error) {
                            console.error(`  - ${key}:`, error[key]);
                        }
                    }
                } else {
                    console.error('오류 객체가 제공되지 않았습니다.');
                }
                
                // 현재 상태 정보 출력
                console.error('현재 상태:');
                console.error('  - Access Token 존재:', !!token);
                console.error('  - Token 길이:', token ? token.length : 0);
                console.error('  - SDK 로드 상태:', !!window.Spotify);
                console.error('  - 플레이어 인스턴스:', !!spotifyPlayer);
                
                // UI 업데이트
                const errorMessage = error?.message || '인증 오류가 발생했습니다.';
                updatePlayerUI('error', errorMessage);
                
                // Promise reject
                reject(new Error(errorMessage));
            });
            
            // 플레이어 초기화 오류 이벤트
            spotifyPlayer.addListener('initialization_error', (error) => {
                console.error('========================================');
                console.error('❌ Spotify 플레이어 초기화 오류 발생');
                console.error('========================================');
                
                // 오류 객체 상세 정보 출력
                if (error) {
                    console.error('오류 객체:', error);
                    console.error('오류 메시지:', error.message || '메시지 없음');
                    console.error('오류 타입:', typeof error);
                    console.error('오류 키:', Object.keys(error || {}));
                    
                    // error 객체의 모든 속성 출력
                    if (typeof error === 'object') {
                        console.error('오류 상세 정보:');
                        for (const key in error) {
                            console.error(`  - ${key}:`, error[key]);
                        }
                    }
                } else {
                    console.error('오류 객체가 제공되지 않았습니다.');
                }
                
                // 현재 상태 정보 출력
                console.error('현재 상태:');
                console.error('  - Access Token 존재:', !!token);
                console.error('  - SDK 로드 상태:', !!window.Spotify);
                console.error('  - 플레이어 인스턴스:', !!spotifyPlayer);
                console.error('  - 플레이어 이름:', spotifyPlayer?.name || '없음');
                
                // UI 업데이트
                const errorMessage = error?.message || '플레이어 초기화 오류가 발생했습니다.';
                updatePlayerUI('error', errorMessage);
                
                // Promise reject
                reject(new Error(errorMessage));
            });

            // 타임아웃 설정 (10초)
            setTimeout(() => {
                reject(new Error('플레이어 준비 시간 초과'));
            }, 10000);
        });

        // 플레이어 오류 이벤트
        spotifyPlayer.addListener('playback_error', ({ message }) => {
            console.error('❌ Spotify 플레이어 재생 오류:', message);
            updatePlayerUI('error', message);
        });

        // 재생 상태 변경 이벤트
        spotifyPlayer.addListener('player_state_changed', (state) => {
            if (!state) {
                return;
            }

            // 재생 상태 업데이트
            spotifyPlayerState.isPlaying = !state.paused;
            spotifyPlayerState.position = state.position;
            spotifyPlayerState.duration = state.duration;

            // 현재 재생 중인 트랙 정보 업데이트
            if (state.track_window.current_track) {
                spotifyPlayerState.currentTrack = {
                    id: state.track_window.current_track.id,
                    name: state.track_window.current_track.name,
                    artists: state.track_window.current_track.artists.map(a => a.name).join(', '),
                    album: state.track_window.current_track.album.name,
                    image: state.track_window.current_track.album.images[0]?.url || null
                };

                // UI 업데이트
                updatePlayerUI('track_changed', spotifyPlayerState.currentTrack);
            }

            // 재생/일시정지 버튼 상태 업데이트
            updatePlayPauseButton(spotifyPlayerState.isPlaying);
        });

        // 플레이어 연결
        const connected = await spotifyPlayer.connect();
        
        if (connected) {
            console.log('✅ Spotify 플레이어가 성공적으로 연결되었습니다.');
            
            // 플레이어가 준비될 때까지 대기
            await playerReady;
            
            // 연결 성공 후 추가 활성화 시도
            try {
                // activateElement 메서드가 있는 경우 호출 (사용자 상호작용 후 활성화)
                if (typeof spotifyPlayer.activateElement === 'function') {
                    console.log('🔄 플레이어 추가 활성화 시도 (connect 후)...');
                    // 주의: activateElement는 사용자 상호작용(클릭 등) 후에만 작동할 수 있음
                    // 여기서는 시도만 하고, 실제 활성화는 ready 이벤트에서 처리
                }
            } catch (error) {
                console.warn('⚠️ 추가 활성화 시도 중 오류 (무시):', error);
            }
            
            console.log('✅ 플레이어 초기화 완료');
        } else {
            console.error('❌ Spotify 플레이어 연결 실패');
            throw new Error('플레이어 연결 실패');
        }

    } catch (error) {
        console.error('❌ Spotify 플레이어 초기화 오류:', error);
        updatePlayerUI('error', error.message);
        throw error;
    } finally {
        isInitializingPlayer = false;
    }
}

/**
 * 플레이어 UI 업데이트
 * @param {string} event - 이벤트 타입 ('ready', 'error', 'track_changed')
 * @param {Object} data - 이벤트 데이터
 */
function updatePlayerUI(event, data = null) {
    const songTitle = document.querySelector('.song-title');
    const artistName = document.querySelector('.artist-name');

    switch (event) {
        case 'ready':
            console.log('🎵 플레이어 준비 완료');
            break;
        
        case 'error':
            if (songTitle) songTitle.textContent = '재생 오류';
            if (artistName) artistName.textContent = data || '알 수 없는 오류';
            break;
        
        case 'track_changed':
            if (data) {
                if (songTitle) songTitle.textContent = data.name;
                if (artistName) artistName.textContent = data.artists;
            }
            break;
    }
}

/**
 * 재생/일시정지 버튼 상태 업데이트
 * @param {boolean} isPlaying - 재생 중 여부
 */
function updatePlayPauseButton(isPlaying) {
    const playPauseBtn = document.getElementById('play-pause-btn');
    if (!playPauseBtn) return;

    const playIcon = playPauseBtn.querySelector('.play-icon');
    const pauseIcon = playPauseBtn.querySelector('.pause-icon');

    if (isPlaying) {
        if (playIcon) playIcon.style.display = 'none';
        if (pauseIcon) pauseIcon.style.display = 'block';
    } else {
        if (playIcon) playIcon.style.display = 'block';
        if (pauseIcon) pauseIcon.style.display = 'none';
    }
}

/**
 * 큐에 저장된 재생 요청을 순차적으로 실행
 */
async function processPlayQueue() {
    if (spotifyPlayQueue.length === 0) {
        return;
    }

    console.log(`📋 재생 큐 처리 시작 (${spotifyPlayQueue.length}개 요청)`);
    
    // 큐의 모든 요청을 순차적으로 실행
    while (spotifyPlayQueue.length > 0) {
        const trackUri = spotifyPlayQueue.shift(); // 큐에서 첫 번째 항목 제거
        
        try {
            await executePlayTrack(trackUri);
            console.log(`✅ 큐에서 재생 완료: ${trackUri}`);
        } catch (error) {
            console.error(`❌ 큐 재생 오류 (${trackUri}):`, error);
            // 에러가 발생해도 다음 요청 계속 처리
        }
    }
    
    console.log('✅ 재생 큐 처리 완료');
}

/**
 * 실제 트랙 재생 실행 함수
 * @param {string} trackUri - Spotify 트랙 URI
 */
async function executePlayTrack(trackUri) {
    const player = window.spotifyPlayer;
    const deviceId = window.spotifyDeviceId;
    
    if (!player || !deviceId) {
        throw new Error('플레이어가 초기화되지 않았습니다.');
    }

    // 현재 재생 중인 트랙 일시정지
    if (spotifyPlayerState.isPlaying) {
        await player.pause();
    }

    // Access Token 가져오기
    const accessToken = getSpotifyToken();
    if (!accessToken) {
        throw new Error('Spotify Access Token이 없습니다. 다시 로그인해주세요.');
    }

    // 서버의 /api/spotify/play 엔드포인트로 재생 요청
    const response = await fetch('http://127.0.0.1:11304/api/spotify/play', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        credentials: 'include',
        body: JSON.stringify({
            device_id: deviceId,
            uri: trackUri
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || errorData.message || `재생 실패: ${response.statusText}`);
    }

    const result = await response.json().catch(() => ({}));
    console.log('✅ 트랙 재생 시작:', trackUri);
    return result;
}

/**
 * 트랙 재생
 * 플레이어가 ready 상태가 아니면 큐에 저장하고, ready 상태면 바로 재생합니다.
 * @param {string} trackUri - Spotify 트랙 URI (예: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh')
 */
async function playTrack(trackUri) {
    // window 객체에서 플레이어와 deviceId 가져오기
    const player = window.spotifyPlayer;
    const deviceId = window.spotifyDeviceId;
    
    // 플레이어가 ready 상태가 아닌 경우 (플레이어가 없거나 deviceId가 없는 경우)
    if (!player || !deviceId) {
        console.log('⚠️ 플레이어가 준비되지 않았습니다. 재생 요청을 큐에 추가합니다:', trackUri);
        
        // 재생 요청을 큐에 추가
        spotifyPlayQueue.push(trackUri);
        console.log(`📋 재생 큐에 추가됨 (현재 큐 크기: ${spotifyPlayQueue.length})`);
        
        // 플레이어가 아직 초기화되지 않은 경우
        if (!player) {
            console.log('ℹ️ 플레이어가 초기화되지 않았습니다. 플레이어 준비 후 자동으로 재생됩니다.');
            return; // 에러를 throw하지 않고 큐에만 추가
        }
        
        // 플레이어는 있지만 deviceId가 없는 경우 (아직 ready 이벤트 대기 중)
        if (player && !deviceId) {
            console.log('ℹ️ 플레이어가 준비 중입니다. ready 이벤트 후 자동으로 재생됩니다.');
            return; // 에러를 throw하지 않고 큐에만 추가
        }
    }

    // 플레이어가 ready 상태인 경우 바로 재생
    try {
        await executePlayTrack(trackUri);
    } catch (error) {
        console.error('❌ 트랙 재생 오류:', error);
        throw error; // 에러를 다시 throw하여 호출자가 처리할 수 있도록
    }
}

/**
 * 재생/일시정지 토글
 */
async function togglePlayback() {
    if (!spotifyPlayer || !window.spotifyPlayer) {
        console.error('플레이어가 초기화되지 않았습니다.');
        return;
    }

    try {
        if (spotifyPlayerState.isPlaying) {
            await spotifyPlayer.pause();
        } else {
            await spotifyPlayer.resume();
        }
    } catch (error) {
        console.error('재생/일시정지 토글 오류:', error);
    }
}

/**
 * 다음 트랙 재생
 */
async function playNextTrack() {
    const player = window.spotifyPlayer;
    if (!player) {
        console.error('플레이어가 초기화되지 않았습니다.');
        return;
    }

    try {
        await player.nextTrack();
    } catch (error) {
        console.error('다음 트랙 재생 오류:', error);
    }
}

/**
 * 이전 트랙 재생
 */
async function playPreviousTrack() {
    const player = window.spotifyPlayer;
    if (!player) {
        console.error('플레이어가 초기화되지 않았습니다.');
        return;
    }

    try {
        await player.previousTrack();
    } catch (error) {
        console.error('이전 트랙 재생 오류:', error);
    }
}

/**
 * Spotify Access Token 가져오기
 * @returns {string} - Access Token
 */
function getSpotifyToken() {
    return sessionStorage.getItem('spotify_access_token') || '';
}

/**
 * Spotify 로그인 함수 - 제거됨
 * 검색 기능만 사용하므로 로그인 불필요
 */
function loginToSpotify() {
    console.log('Spotify 로그인 기능이 비활성화되었습니다. 검색 기능만 사용 가능합니다.');
    return;
    /*
    console.log('========================================');
    console.log('🔄 Spotify 로그인 시작');
    console.log('========================================');
    
    // 이미 로그인 중이면 중복 실행 방지
    if (window.spotifyLoginInProgress) {
        console.log('⚠️ Spotify 로그인이 이미 진행 중입니다.');
        return;
    }
    
    window.spotifyLoginInProgress = true;
    console.log('✅ 로그인 플래그 설정 완료');
    
    // 이전 메시지 핸들러가 있다면 제거
    if (window.spotifyMessageHandler) {
        console.log('🔄 이전 메시지 핸들러 제거 중...');
        window.removeEventListener('message', window.spotifyMessageHandler);
        window.spotifyMessageHandler = null;
        console.log('✅ 이전 메시지 핸들러 제거 완료');
    }
    
    // 새 창에서 로그인 페이지 열기
    const loginUrl = 'http://127.0.0.1:11304/api/spotify/login';
    console.log('🔄 로그인 창 열기:', loginUrl);
    
    const loginWindow = window.open(
        loginUrl,
        'Spotify Login',
        'width=500,height=600,scrollbars=yes'
    );

    if (!loginWindow) {
        console.error('❌ 로그인 창 열기 실패: 팝업이 차단되었습니다.');
        alert('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
        window.spotifyLoginInProgress = false;
        return;
    }
    
    console.log('✅ 로그인 창 열기 성공');

    // 메시지 리스너로 토큰 받기
    const messageHandler = async function(event) {
        console.log('📨 메시지 수신:', {
            origin: event.origin,
            type: event.data?.type,
            data: event.data
        });
        
        // 보안을 위해 origin 확인 (로컬 개발 환경)
        if (event.origin !== 'http://127.0.0.1:11304' && event.origin !== window.location.origin) {
            console.warn('⚠️ 허용되지 않은 origin에서 메시지 수신:', event.origin);
            return;
        }

        if (event.data.type === 'spotify-auth-success') {
            console.log('========================================');
            console.log('✅ Spotify 로그인 성공 메시지 수신');
            console.log('========================================');
            
            const { accessToken, refreshToken, expiresIn } = event.data;
            console.log('📦 수신된 토큰 정보:');
            console.log('  - Access Token 존재:', !!accessToken);
            console.log('  - Refresh Token 존재:', !!refreshToken);
            console.log('  - Expires In:', expiresIn);
            
            // 토큰 저장
            sessionStorage.setItem('spotify_access_token', accessToken);
            sessionStorage.setItem('spotify_refresh_token', refreshToken);
            sessionStorage.setItem('spotify_token_expires_in', expiresIn);
            sessionStorage.setItem('spotify_token_expires_at', Date.now() + (expiresIn * 1000));
            
            console.log('✅ Spotify 토큰 sessionStorage 저장 완료');
            
            // 메시지 리스너 제거 (중복 처리 방지)
            window.removeEventListener('message', messageHandler);
            window.spotifyMessageHandler = null;
            loginWindow.close();
            window.spotifyLoginInProgress = false;
            
            // SDK가 로드될 때까지 대기
            let attempts = 0;
            const maxAttempts = 100; // 10초로 증가 (100ms * 100)
            
            while (!window.Spotify && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (!window.Spotify) {
                console.error('❌ Spotify SDK 로드 시간 초과');
                // SDK가 로드되지 않았을 때 재시도 메커니즘 추가
                console.log('⚠️ SDK를 수동으로 확인합니다...');
                
                // onSpotifyWebPlaybackSDKReady가 호출되었는지 확인
                if (typeof window.onSpotifyWebPlaybackSDKReady === 'function') {
                    console.log('✅ SDK 콜백 함수가 존재합니다. 잠시 더 대기합니다...');
                    // 추가로 3초 대기
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
                
                if (!window.Spotify) {
                    alert('Spotify SDK 로드 시간이 초과되었습니다. 페이지를 새로고침해주세요.');
                    return;
                }
            }
            
            // 토큰을 전역 변수에 저장 (SDK 로드 완료 후 onSpotifyWebPlaybackSDKReady에서 초기화)
            window.spotifyAccessToken = accessToken;
            console.log('✅ Spotify 토큰이 전역 변수에 저장되었습니다.');
            
            // SDK가 이미 로드되어 있으면 즉시 초기화 시도
            console.log('🔄 SDK 로드 상태 확인 중...');
            console.log('  - window.Spotify:', !!window.Spotify, typeof window.Spotify);
            console.log('  - window.spotifySDKReady:', window.spotifySDKReady);
            
            // SDK가 로드되었는지 확인 (spotifySDKReady 플래그도 확인)
            if (window.Spotify || window.spotifySDKReady) {
                // window.Spotify가 없지만 플래그가 있으면 잠시 대기
                if (!window.Spotify && window.spotifySDKReady) {
                    console.log('⚠️ SDK 플래그는 있지만 window.Spotify가 없습니다. SDK 할당을 기다립니다...');
                    let sdkAttempts = 0;
                    const sdkMaxAttempts = 50; // 5초
                    while (!window.Spotify && sdkAttempts < sdkMaxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        sdkAttempts++;
                    }
                }
                
                if (window.Spotify) {
                    console.log('✅ SDK가 로드되어 있습니다. 플레이어 초기화 시도...');
                    
                    // initSpotifyPlayer 함수가 정의될 때까지 대기
                    if (!window.initSpotifyPlayer) {
                        console.log('ℹ️ initSpotifyPlayer 함수가 아직 정의되지 않았습니다. 대기 중...');
                        let attempts = 0;
                        const maxAttempts = 50; // 5초
                        while (!window.initSpotifyPlayer && attempts < maxAttempts) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                            attempts++;
                        }
                    }
                    
                    if (window.initSpotifyPlayer) {
                        try {
                            console.log('🔄 initSpotifyPlayer 함수 호출 시작...');
                            await window.initSpotifyPlayer(accessToken);
                            console.log('✅ Spotify 플레이어 초기화 완료');
                            alert('Spotify 로그인이 완료되었습니다! 이제 음악을 재생할 수 있습니다.');
                        } catch (error) {
                            console.error('❌ 플레이어 초기화 오류:', error);
                            console.error('에러 상세:', error.message);
                            console.error('에러 스택:', error.stack);
                            alert('플레이어 초기화 중 오류가 발생했습니다: ' + error.message);
                        }
                    } else if (window.initializeSpotifyPlayerIfReady) {
                        // initializeSpotifyPlayerIfReady 함수가 있으면 사용
                        console.log('🔄 initializeSpotifyPlayerIfReady 함수 호출...');
                        window.initializeSpotifyPlayerIfReady();
                        console.log('✅ 플레이어 초기화 요청 완료 (비동기 처리 중)');
                        alert('Spotify 로그인이 완료되었습니다! 플레이어가 준비되면 음악을 재생할 수 있습니다.');
                    } else {
                        console.warn('⚠️ initSpotifyPlayer 함수를 찾을 수 없습니다.');
                        console.log('ℹ️ SDK 로드 완료 후 자동으로 플레이어가 초기화됩니다.');
                        alert('Spotify 로그인이 완료되었습니다! 페이지를 새로고침해주세요.');
                    }
                } else {
                    console.warn('⚠️ window.Spotify를 찾을 수 없습니다.');
                    console.log('ℹ️ SDK 로드 완료 후 자동으로 플레이어가 초기화됩니다.');
                    if (window.initializeSpotifyPlayerIfReady) {
                        console.log('🔄 initializeSpotifyPlayerIfReady 함수 호출 시도...');
                        window.initializeSpotifyPlayerIfReady();
                    }
                    alert('Spotify 로그인이 완료되었습니다! 플레이어가 준비되면 음악을 재생할 수 있습니다.');
                }
            } else {
                console.log('ℹ️ SDK가 아직 로드되지 않았습니다. SDK 로드 완료 후 자동으로 플레이어가 초기화됩니다.');
                alert('Spotify 로그인이 완료되었습니다! 플레이어가 준비되면 음악을 재생할 수 있습니다.');
            }
        } else if (event.data.type === 'spotify-auth-error') {
            console.error('Spotify 로그인 오류:', event.data.error);
            alert('Spotify 로그인에 실패했습니다: ' + event.data.error);
            
            // 메시지 리스너 제거
            window.removeEventListener('message', messageHandler);
            window.spotifyMessageHandler = null;
            loginWindow.close();
            window.spotifyLoginInProgress = false;
        }
    };
    
    // 전역에 핸들러 저장 (나중에 제거하기 위해)
    window.spotifyMessageHandler = messageHandler;
    window.addEventListener('message', messageHandler);

    // 창이 닫혔는지 확인
    const checkClosed = setInterval(() => {
        if (loginWindow.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);
            window.spotifyMessageHandler = null;
            window.spotifyLoginInProgress = false;
        }
    }, 1000);
    */
}

/**
 * URL 쿼리 매개변수에서 access_token을 추출하는 함수
 * @returns {string|null} - 추출된 access_token 또는 null
 */
function extractAccessTokenFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    return accessToken;
}

/**
 * 토큰을 전역 변수와 sessionStorage에 저장하는 함수
 * 플레이어 초기화는 window.onSpotifyWebPlaybackSDKReady에서만 수행됩니다.
 * @param {string} accessToken - Spotify Access Token
 * @param {string} refreshToken - Spotify Refresh Token (선택)
 * @param {string} expiresIn - 토큰 만료 시간 (초 단위, 선택)
 */
function saveSpotifyToken(accessToken, refreshToken = null, expiresIn = null) {
    if (!accessToken) {
        console.warn('Access Token이 없습니다.');
        return;
    }

    console.log('💾 Spotify 토큰 저장 중...');

    // 전역 변수에 토큰 저장
    window.spotifyAccessToken = accessToken;
    
    // sessionStorage에도 저장 (페이지 새로고침 시 복구용)
    sessionStorage.setItem('spotify_access_token', accessToken);
    
    if (refreshToken) {
        sessionStorage.setItem('spotify_refresh_token', refreshToken);
    }
    
    if (expiresIn) {
        const expiresInNum = parseInt(expiresIn);
        sessionStorage.setItem('spotify_token_expires_in', expiresInNum.toString());
        sessionStorage.setItem('spotify_token_expires_at', (Date.now() + (expiresInNum * 1000)).toString());
    }

    console.log('✅ Spotify 토큰이 저장되었습니다. SDK 로드 완료 후 자동으로 플레이어가 초기화됩니다.');
}

// 페이지 로드 시 즉시 실행 (DOMContentLoaded 전에도 실행 가능)
(function() {
    // URL 쿼리 매개변수에서 access_token 추출
    const accessToken = extractAccessTokenFromURL();
    
    if (accessToken) {
        console.log('✅ URL에서 Spotify 토큰을 발견했습니다.');
        
        // URL에서 쿼리 매개변수 즉시 제거 (보안 및 중복 처리 방지)
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        // URL에서 추가 정보 추출
        const urlParams = new URLSearchParams(window.location.search);
        const refreshToken = urlParams.get('refresh_token');
        const expiresIn = urlParams.get('expires_in');
        
        // 토큰을 전역 변수와 sessionStorage에 저장 (플레이어 초기화는 SDK 로드 후에만 수행)
        saveSpotifyToken(accessToken, refreshToken, expiresIn);
        
        console.log('ℹ️ SDK 로드 완료 후 자동으로 플레이어가 초기화됩니다.');
    } else {
        // URL에 토큰이 없는 경우, sessionStorage에서 토큰을 전역 변수로 복원
        const savedToken = sessionStorage.getItem('spotify_access_token');
        if (savedToken) {
            window.spotifyAccessToken = savedToken;
            console.log('✅ sessionStorage에서 토큰을 복원했습니다.');
        }
    }
})();

// 페이지 로드 시 저장된 토큰으로 플레이어 초기화 (쿼리 매개변수에 토큰이 없는 경우)
// DOMContentLoaded 이벤트에서 추가 작업 없음
// 모든 플레이어 초기화는 window.onSpotifyWebPlaybackSDKReady에서만 수행됩니다.

// 전역 스코프에 함수 노출
window.initSpotifyPlayer = initSpotifyPlayer;
window.playTrack = playTrack;
window.togglePlayback = togglePlayback;
window.playNextTrack = playNextTrack;
window.playPreviousTrack = playPreviousTrack;
window.loginToSpotify = loginToSpotify;

// ============================================
// MongoDB API를 통한 챕터 로드 함수
// ============================================

/**
 * 서버 API에서 챕터 텍스트를 가져와서 viewer에 표시하는 함수
 * 각 단어를 <span> 태그로 감싸서 클릭 이벤트를 추가합니다.
 * 
 * @param {string} bookTitle - 책 제목 (예: "Pride and Prejudice")
 * @param {number} chapterNumber - 챕터 번호 (예: 1)
 */
async function loadChapter(bookTitle, chapterNumber) {
    try {
        // viewer 요소 확인
        const viewerElement = document.getElementById('original-text-viewer');
        if (!viewerElement) {
            console.error('❌ viewer 요소를 찾을 수 없습니다.');
            return;
        }

        // 로딩 상태 표시
        viewerElement.innerHTML = '<p style="text-align: center; color: #666;">챕터를 불러오는 중...</p>';

        let data = null;
        let textContent = null;
        let chapterNum = chapterNumber;
        let bookTitleText = bookTitle;
        let author = '';

        // The Great Gatsby인 경우 JSON 파일에서 직접 읽기
        console.log(`🔍 loadChapter 호출: bookTitle="${bookTitle}", chapterNumber=${chapterNumber}`);
        if (bookTitle === 'The Great Gatsby' || bookTitle === 'The_Great_Gatsby' || bookTitle.includes('Gatsby')) {
            console.log('📚 The Great Gatsby 감지 - JSON 파일에서 로드 시도');
            try {
                // 절대 경로 사용 (서버의 정적 파일 경로)
                const jsonUrl = window.location.origin + '/data/The_Great_Gatsby_chapters.json';
                console.log(`📂 JSON 파일 경로: ${jsonUrl}`);
                const jsonResponse = await fetch(jsonUrl);
                
                if (!jsonResponse.ok) {
                    throw new Error(`JSON 파일을 불러올 수 없습니다. (HTTP ${jsonResponse.status})`);
                }
                
                const jsonData = await jsonResponse.json();
                console.log(`✅ JSON 파일 로드 성공: 총 ${jsonData.chapters?.length || 0}개 챕터`);
                
                // 해당 챕터 찾기
                const chapter = jsonData.chapters.find(ch => ch.chapter_number === chapterNumber);
                
                if (!chapter) {
                    throw new Error(`챕터 ${chapterNumber}를 찾을 수 없습니다. (사용 가능한 챕터: ${jsonData.chapters.map(ch => ch.chapter_number).join(', ')})`);
                }
                
                // 데이터 구조 맞추기
                data = {
                    text_content: chapter.content,
                    chapter_number: chapter.chapter_number,
                    book_title: jsonData.book_title,
                    author: jsonData.author
                };
                
                textContent = chapter.content;
                chapterNum = chapter.chapter_number;
                bookTitleText = jsonData.book_title;
                author = jsonData.author;
                
                console.log(`✅ The Great Gatsby 챕터 ${chapterNumber} 로드 완료 (JSON 파일에서)`);
            } catch (jsonError) {
                console.error('❌ JSON 파일 로드 오류:', jsonError);
                // JSON 파일 로드 실패 시 에러를 던짐 (API로 폴백하지 않음)
                throw new Error(`The Great Gatsby 챕터를 로드할 수 없습니다: ${jsonError.message}`);
            }
        } else {
            console.log('📚 다른 책 감지 - API에서 로드 시도');
            // 기존 API 방식 (다른 책들)
            // API URL 생성 (bookTitle을 URL 인코딩)
            const encodedBookTitle = encodeURIComponent(bookTitle);
            const apiUrl = `http://localhost:11304/api/book/chapter/${encodedBookTitle}/${chapterNumber}`;

            console.log(`📖 챕터 로드 시작: ${bookTitle} - Chapter ${chapterNumber}`);
            console.log(`🔗 API URL: ${apiUrl}`);

            // API 호출
            const response = await fetch(apiUrl);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: '알 수 없는 오류' }));
                throw new Error(errorData.message || `HTTP 오류: ${response.status}`);
            }

            data = await response.json();

            if (!data.text_content) {
                throw new Error('챕터 내용이 없습니다.');
            }

            // 텍스트 내용 가져오기 (백엔드 구조에 맞게)
            textContent = data.text_content;
            chapterNum = data.chapter_number || chapterNumber;
            bookTitleText = data.book_title || bookTitle;
            author = data.author || '';
        }

        // 텍스트를 단어별로 분리하고 <span> 태그로 감싸기
        // textContent는 위에서 이미 설정됨 (JSON 파일 또는 API 응답에서)
        const words = textContent.split(/(\s+)/); // 공백도 함께 분리하여 보존

        // 각 단어를 <span> 태그로 감싸기
        const wrappedWords = words.map((word, index) => {
            // 공백인 경우 그대로 반환
            if (/^\s+$/.test(word)) {
                return word;
            }

            // 단어인 경우 <span> 태그로 감싸기 (viewer.js와 호환성을 위해 .word 클래스 사용)
            return `<span class="word" data-word="${word.replace(/"/g, '&quot;')}" data-index="${index}">${word}</span>`;
        });

        // 로마 숫자 변환 함수
        function toRomanNumeral(num) {
            if (!num || num < 1) return 'I';
            const romanNumerals = [
                { value: 1000, numeral: 'M' },
                { value: 900, numeral: 'CM' },
                { value: 500, numeral: 'D' },
                { value: 400, numeral: 'CD' },
                { value: 100, numeral: 'C' },
                { value: 90, numeral: 'XC' },
                { value: 50, numeral: 'L' },
                { value: 40, numeral: 'XL' },
                { value: 10, numeral: 'X' },
                { value: 9, numeral: 'IX' },
                { value: 5, numeral: 'V' },
                { value: 4, numeral: 'IV' },
                { value: 1, numeral: 'I' }
            ];
            let result = '';
            for (const { value, numeral } of romanNumerals) {
                while (num >= value) {
                    result += numeral;
                    num -= value;
                }
            }
            return result;
        }
        
        // chapterNum, bookTitleText, author는 위에서 이미 설정됨 (JSON 파일 또는 API 응답에서)
        const chapterTitle = `Chapter ${toRomanNumeral(chapterNum)}]`;
        
        // HTML 생성 (viewer.js와 동일한 구조 사용)
        const chapterHeader = `
            <div class="chapter-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h5 class="chapter-title" style="margin: 0;">${chapterTitle} ${escapeHtml(bookTitleText)}${author ? ' - ' + escapeHtml(author) : ''}</h5>
                <button 
                    id="chapter-translate-btn" 
                    class="chapter-translate-btn" 
                    data-book-title="${escapeHtml(bookTitleText)}"
                    data-chapter-num="${chapterNum}"
                    style="padding: 8px 16px; background: #4a90e2; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.3s ease; display: flex; align-items: center; gap: 6px;"
                    title="한국어 번역 보기"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 8l6 6"></path>
                        <path d="M4 14l6-6 2-3"></path>
                        <path d="M2 5h12"></path>
                        <path d="M7 2h1"></path>
                        <path d="M22 22l-5-10-5 10"></path>
                        <path d="M14 18h6"></path>
                    </svg>
                    <span>한국어 번역</span>
                </button>
            </div>
        `;
        
        // 번역 영역 추가
        const translationSection = `
            <div id="chapter-translation-section" style="display: none; margin-top: 20px; padding: 20px; background: #f9f9f9; border-radius: 8px; border: 1px solid #e0e0e0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h5 style="margin: 0; color: #333; font-size: 16px;">📖 한국어 번역</h5>
                    <button 
                        id="close-translation-btn" 
                        style="background: transparent; border: none; cursor: pointer; padding: 4px; color: #666; font-size: 18px;"
                        title="번역 닫기"
                    >
                        ×
                    </button>
                </div>
                <div id="chapter-translation-content" style="line-height: 1.8; color: #333; font-size: 15px;">
                    <p style="text-align: center; color: #666;">번역 중...</p>
                </div>
            </div>
        `;
        
        // 원문/번역 토글 버튼 추가
        const viewToggleSection = `
            <div id="chapter-view-toggle" style="display: none; margin-bottom: 12px; text-align: center;">
                <button 
                    id="show-original-btn" 
                    class="view-toggle-btn active"
                    style="padding: 8px 20px; background: #4a90e2; color: white; border: none; border-radius: 6px 0 0 6px; cursor: pointer; font-size: 14px;"
                >
                    원문
                </button>
                <button 
                    id="show-translation-btn" 
                    class="view-toggle-btn"
                    style="padding: 8px 20px; background: #e0e0e0; color: #666; border: none; border-radius: 0 6px 6px 0; cursor: pointer; font-size: 14px; margin-left: -1px;"
                >
                    번역
                </button>
            </div>
        `;
        
        const htmlContent = chapterHeader + viewToggleSection + '<div id="chapter-original-text" class="chapter-text">' + wrappedWords.join(' ') + '</div>' + translationSection;

        // viewer에 내용 삽입
        viewerElement.innerHTML = htmlContent;
        
        // 번역 버튼 이벤트 리스너 추가
        const translateBtn = viewerElement.querySelector('#chapter-translate-btn');
        if (translateBtn) {
            translateBtn.addEventListener('click', async function() {
                if (typeof window.translateCurrentChapter === 'function') {
                    await window.translateCurrentChapter(bookTitleText, chapterNum, textContent);
                } else {
                    console.error('translateCurrentChapter 함수를 찾을 수 없습니다.');
                }
            });
        }
        
        // 번역 닫기 버튼 이벤트 리스너
        const closeTranslationBtn = viewerElement.querySelector('#close-translation-btn');
        if (closeTranslationBtn) {
            closeTranslationBtn.addEventListener('click', function() {
                const translationSection = viewerElement.querySelector('#chapter-translation-section');
                const viewToggle = viewerElement.querySelector('#chapter-view-toggle');
                if (translationSection) translationSection.style.display = 'none';
                if (viewToggle) viewToggle.style.display = 'none';
                const originalText = viewerElement.querySelector('#chapter-original-text');
                if (originalText) originalText.style.display = 'block';
            });
        }
        
        // 원문/번역 토글 버튼 이벤트 리스너
        const showOriginalBtn = viewerElement.querySelector('#show-original-btn');
        const showTranslationBtn = viewerElement.querySelector('#show-translation-btn');
        
        if (showOriginalBtn) {
            showOriginalBtn.addEventListener('click', function() {
                const originalText = viewerElement.querySelector('#chapter-original-text');
                const translationSection = viewerElement.querySelector('#chapter-translation-section');
                if (originalText) originalText.style.display = 'block';
                if (translationSection) translationSection.style.display = 'none';
                this.style.background = '#4a90e2';
                this.style.color = 'white';
                if (showTranslationBtn) {
                    showTranslationBtn.style.background = '#e0e0e0';
                    showTranslationBtn.style.color = '#666';
                }
            });
        }
        
        if (showTranslationBtn) {
            showTranslationBtn.addEventListener('click', function() {
                const originalText = viewerElement.querySelector('#chapter-original-text');
                const translationSection = viewerElement.querySelector('#chapter-translation-section');
                if (originalText) originalText.style.display = 'none';
                if (translationSection) translationSection.style.display = 'block';
                this.style.background = '#4a90e2';
                this.style.color = 'white';
                if (showOriginalBtn) {
                    showOriginalBtn.style.background = '#e0e0e0';
                    showOriginalBtn.style.color = '#666';
                }
            });
        }

        // 각 단어에 클릭 이벤트는 viewer.js의 이벤트 위임으로 처리됩니다.
        // (viewer.js의 이벤트 리스너가 이미 등록되어 있음)
        
        // DOM이 완전히 렌더링된 후 확인
        setTimeout(() => {
            const wordSpans = viewerElement.querySelectorAll('.word');
            console.log(`✅ 챕터 표시 완료: ${wordSpans.length}개의 단어가 클릭 가능합니다.`);
            console.log('🔍 DOM 구조 확인:', {
                viewerElement: !!viewerElement,
                chapterTextDiv: !!viewerElement.querySelector('.chapter-text'),
                wordElements: wordSpans.length,
                firstWord: wordSpans[0] ? wordSpans[0].textContent : 'none'
            });
        }, 0);

    } catch (error) {
        console.error('❌ 챕터 로드 오류:', error);
        
        const viewerElement = document.getElementById('original-text-viewer');
        if (viewerElement) {
            viewerElement.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #d32f2f;">
                    <p style="font-size: 1.1rem; margin-bottom: 10px;">⚠️ 챕터를 불러올 수 없습니다</p>
                    <p style="color: #666; font-size: 0.9rem;">${error.message}</p>
                </div>
            `;
        }
    }
}

// 전역 스코프에 함수 노출
window.loadChapter = loadChapter;

// ============================================
// 독서 기록 관리 기능
// ============================================

/**
 * 독서 기록을 저장하는 함수
 * @param {string} placeName - 장소 이름
 * @param {string} placeAddress - 장소 주소
 * @param {string} bookTitle - 책 제목 (선택)
 */
function saveReadingRecord(placeName, placeAddress, bookTitle = '') {
    try {
        // localStorage에서 기존 기록 가져오기
        const records = JSON.parse(localStorage.getItem('readingRecords') || '[]');
        
        // 새 기록 생성
        const newRecord = {
            id: Date.now().toString(),
            placeName: placeName,
            placeAddress: placeAddress,
            bookTitle: bookTitle || '책 정보 없음',
            date: new Date().toISOString(),
            formattedDate: formatDate(new Date())
        };
        
        // 맨 앞에 추가 (최신 기록이 위에 오도록)
        records.unshift(newRecord);
        
        // localStorage에 저장
        localStorage.setItem('readingRecords', JSON.stringify(records));
        
        console.log('✅ 독서 기록 저장 완료:', newRecord);
        alert(`"${placeName}"에서 독서 기록이 저장되었습니다!`);
        
        // 마이페이지가 표시 중이면 기록 목록 업데이트
        if (document.getElementById('mypage-page')?.style.display !== 'none') {
            loadReadingRecords();
        }
    } catch (error) {
        console.error('❌ 독서 기록 저장 오류:', error);
        alert('독서 기록 저장 중 오류가 발생했습니다.');
    }
}

/**
 * 날짜를 포맷팅하는 함수
 * @param {Date} date - 날짜 객체
 * @returns {string} - 포맷된 날짜 문자열
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}년 ${month}월 ${day}일`;
}

/**
 * 마이페이지에 독서 기록을 표시하는 함수
 * 최대 3개까지만 표시하고, 3개 이상이면 더보기 버튼 활성화
 */
function loadReadingRecords() {
    try {
        const records = JSON.parse(localStorage.getItem('readingRecords') || '[]');
        const placesList = document.querySelector('.reading-places-list');
        const moreBtn = document.querySelector('.mypage-places .section-toggle-btn');
        
        if (!placesList) {
            console.warn('⚠️ 독서 기록 목록 요소를 찾을 수 없습니다.');
            return;
        }
        
        // 기존 내용 제거
        placesList.innerHTML = '';
        
        if (records.length === 0) {
            placesList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">독서 기록이 없습니다.</p>';
            if (moreBtn) moreBtn.style.display = 'none';
            return;
        }
        
        // 최대 3개까지만 표시
        const displayRecords = records.slice(0, 3);
        const hasMore = records.length > 3;
        
        // 기록 표시
        displayRecords.forEach(record => {
            const recordItem = document.createElement('div');
            recordItem.className = 'reading-place-item';
            recordItem.setAttribute('data-record-id', record.id);
            recordItem.innerHTML = `
                <div class="place-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                </div>
                <div class="place-details">
                    <h5 class="place-name">${escapeHtml(record.placeName)}</h5>
                    <p class="place-date">${record.formattedDate}</p>
                    <p class="place-book">${escapeHtml(record.bookTitle)}</p>
                </div>
            `;
            placesList.appendChild(recordItem);
        });
        
        // 더보기 버튼 표시/숨김
        if (moreBtn) {
            if (hasMore) {
                moreBtn.style.display = 'block';
                moreBtn.textContent = '더보기';
            } else {
                moreBtn.style.display = 'none';
            }
        }
        
        console.log(`✅ 독서 기록 표시 완료: ${displayRecords.length}개 (전체 ${records.length}개)`);
    } catch (error) {
        console.error('❌ 독서 기록 불러오기 오류:', error);
    }
}

/**
 * 더보기 버튼 클릭 시 모달 창을 여는 함수
 */
function openReadingRecordsModal() {
    try {
        const records = JSON.parse(localStorage.getItem('readingRecords') || '[]');
        
        // 모달 HTML 생성
        const modalHTML = `
            <div id="reading-records-modal" class="reading-records-modal" style="display: flex;">
                <div class="modal-overlay"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>독서한 장소 기록</h3>
                        <button type="button" class="modal-close-btn" aria-label="닫기">×</button>
                    </div>
                    <div class="modal-body">
                        ${records.length === 0 
                            ? '<p style="text-align: center; color: #666; padding: 40px;">독서 기록이 없습니다.</p>'
                            : records.map(record => `
                                <div class="modal-record-item" data-record-id="${record.id}">
                                    <div class="modal-record-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                            <circle cx="12" cy="10" r="3"></circle>
                                        </svg>
                                    </div>
                                    <div class="modal-record-details">
                                        <h5>${escapeHtml(record.placeName)}</h5>
                                        <p class="modal-record-address">${escapeHtml(record.placeAddress)}</p>
                                        <p class="modal-record-date">${record.formattedDate}</p>
                                        <p class="modal-record-book">${escapeHtml(record.bookTitle)}</p>
                                    </div>
                                    <button type="button" class="modal-delete-btn" data-record-id="${record.id}" aria-label="삭제">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        </svg>
                                    </button>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            </div>
        `;
        
        // 기존 모달이 있으면 제거
        const existingModal = document.getElementById('reading-records-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // 모달 추가
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 모달 닫기 버튼 이벤트
        const modal = document.getElementById('reading-records-modal');
        const closeBtn = modal.querySelector('.modal-close-btn');
        const overlay = modal.querySelector('.modal-overlay');
        
        const closeModal = () => {
            modal.remove();
        };
        
        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', closeModal);
        
        // ESC 키로 닫기
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
        
        // 삭제 버튼 이벤트
        const deleteButtons = modal.querySelectorAll('.modal-delete-btn');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const recordId = this.getAttribute('data-record-id');
                deleteReadingRecord(recordId);
            });
        });
        
    } catch (error) {
        console.error('❌ 모달 열기 오류:', error);
    }
}

/**
 * 독서 기록을 삭제하는 함수
 * @param {string} recordId - 기록 ID
 */
function deleteReadingRecord(recordId) {
    if (!confirm('이 독서 기록을 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        const records = JSON.parse(localStorage.getItem('readingRecords') || '[]');
        const filteredRecords = records.filter(r => r.id !== recordId);
        localStorage.setItem('readingRecords', JSON.stringify(filteredRecords));
        
        console.log('✅ 독서 기록 삭제 완료:', recordId);
        
        // 모달과 마이페이지 모두 업데이트
        const modal = document.getElementById('reading-records-modal');
        if (modal) {
            // 모달이 열려있으면 다시 열기 (업데이트된 목록으로)
            openReadingRecordsModal();
        }
        
        // 마이페이지 업데이트
        loadReadingRecords();
        
        alert('독서 기록이 삭제되었습니다.');
    } catch (error) {
        console.error('❌ 독서 기록 삭제 오류:', error);
        alert('독서 기록 삭제 중 오류가 발생했습니다.');
    }
}

// 더보기 버튼 이벤트 리스너
document.addEventListener('DOMContentLoaded', function() {
    // 더보기 버튼 클릭 이벤트
    const moreBtn = document.querySelector('.mypage-places .section-toggle-btn');
    if (moreBtn) {
        moreBtn.addEventListener('click', openReadingRecordsModal);
    }
    
    // 마이페이지 표시 시 기록 불러오기
    const mypagePage = document.getElementById('mypage-page');
    if (mypagePage) {
        // 페이지 전환 감지를 위한 MutationObserver 또는 showPage 함수 수정
        // 일단 초기 로드 시 한 번 불러오기
        loadReadingRecords();
    }
});


// 전역 스코프에 함수 노출
window.saveReadingRecord = saveReadingRecord;
window.loadReadingRecords = loadReadingRecords;
window.openReadingRecordsModal = openReadingRecordsModal;
window.deleteReadingRecord = deleteReadingRecord;

// 페이지를 떠날 때 Socket 연결 해제
window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.disconnect();
    }
});
