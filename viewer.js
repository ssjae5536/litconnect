/**
 * viewer.js
 * LitConnect 영어 원서 뷰어를 위한 JavaScript
 * MongoDB API에서 챕터 텍스트를 가져와서 표시하는 기능
 */

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
        viewerElement.innerHTML = '<div class="loading">챕터를 불러오는 중...</div>';

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
            textContent = data.textContent || data.text_content;
            chapterNum = data.chapter_number || chapterNumber;
            bookTitleText = data.book_title || bookTitle;
            author = data.author || '';
        }
        
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
        
        const chapterHeader = `
            <div class="chapter-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h5 class="chapter-title" style="margin: 0;">Chapter ${toRomanNumeral(chapterNum)}.] ${escapeHtml(bookTitleText)}${author ? ' - ' + escapeHtml(author) : ''}</h5>
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

        // 2. 띄어쓰기를 기준으로 텍스트를 단어 배열로 분리
        //    정규 표현식(/\s+/)을 사용하면 공백, 줄 바꿈 등을 기준으로 정확하게 분리할 수 있습니다.
        const words = textContent.split(/\s+/);

        // 3. 각 단어를 <span> 태그로 감싸서 HTML 문자열로 만듭니다.
        const textContentHtml = words.map(word => 
            // word 클래스를 추가해야 클릭 이벤트가 작동합니다.
            `<span class="word">${escapeHtml(word)}</span>`
        ).join(' '); // 다시 띄어쓰기로 연결합니다.

        // 4. 번역 영역 추가
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
        
        // 5. 원문/번역 토글 버튼 추가
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
        
        // 6. 헤더와 텍스트를 합쳐서 원서 텍스트 영역에 삽입
        viewerElement.innerHTML = chapterHeader + viewToggleSection + '<div id="chapter-original-text" class="chapter-text">' + textContentHtml + '</div>' + translationSection;

        // 7. 번역 버튼 이벤트 리스너 추가
        const translateBtn = viewerElement.querySelector('#chapter-translate-btn');
        if (translateBtn) {
            translateBtn.addEventListener('click', async function() {
                await translateCurrentChapter(bookTitleText, chapterNum, textContent);
            });
        }
        
        // 8. 번역 닫기 버튼 이벤트 리스너
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
        
        // 9. 원문/번역 토글 버튼 이벤트 리스너
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

        // 각 단어에 클릭 이벤트는 script.js의 이벤트 위임으로 처리됩니다.

    } catch (error) {
        console.error('❌ 챕터 로드 오류:', error);
        
        const viewerElement = document.getElementById('original-text-viewer');
        if (viewerElement) {
            viewerElement.innerHTML = `
                <div class="error">
                    <p style="font-size: 1.1rem; margin-bottom: 10px;">⚠️ 챕터를 불러올 수 없습니다</p>
                    <p style="color: #666; font-size: 0.9rem;">${escapeHtml(error.message)}</p>
                    <p style="color: #999; font-size: 0.8rem; margin-top: 10px;">서버가 실행 중인지 확인해주세요.</p>
                </div>
            `;
        }
    }
}

/**
 * HTML 이스케이프 함수
 * @param {string} text - 이스케이프할 텍스트
 * @returns {string} - 이스케이프된 텍스트
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 챕터를 한국어로 번역하는 함수
async function translateCurrentChapter(bookTitle, chapterNum, textContent) {
    const viewerElement = document.getElementById('original-text-viewer');
    if (!viewerElement) {
        console.error('❌ viewer 요소를 찾을 수 없습니다.');
        return;
    }
    
    const translationContent = viewerElement.querySelector('#chapter-translation-content');
    const translationSection = viewerElement.querySelector('#chapter-translation-section');
    const viewToggle = viewerElement.querySelector('#chapter-view-toggle');
    
    if (!translationContent || !translationSection) {
        console.error('❌ 번역 영역을 찾을 수 없습니다.');
        return;
    }
    
    // 번역 영역 표시
    translationSection.style.display = 'block';
    if (viewToggle) viewToggle.style.display = 'block';
    
    // 로딩 상태 표시
    translationContent.innerHTML = '<p style="text-align: center; color: #666;">번역 중입니다. 잠시만 기다려주세요...</p>';
    
    try {
        // fetchTranslation 함수 사용 (EN -> KO)
        let translatedText;
        
        if (typeof window.fetchTranslation === 'function') {
            translatedText = await window.fetchTranslation(textContent, 'ko');
        } else {
            // 직접 API 호출
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
            if (data.success && data.translatedText) {
                translatedText = data.translatedText;
            } else {
                throw new Error(data.message || '번역 결과를 받을 수 없습니다.');
            }
        }
        
        // 번역 결과를 문단 단위로 분리하여 표시
        const paragraphs = translatedText.split(/\n\n+/).filter(p => p.trim());
        const translationHtml = paragraphs.map(para => {
            const trimmedPara = para.trim();
            if (!trimmedPara) return '';
            return `<p style="margin: 0 0 12px 0; line-height: 1.8;">${escapeHtml(trimmedPara)}</p>`;
        }).join('');
        
        translationContent.innerHTML = translationHtml || `<p>${escapeHtml(translatedText)}</p>`;
        
        console.log('✅ 챕터 번역 완료');
        
    } catch (error) {
        console.error('❌ 챕터 번역 오류:', error);
        translationContent.innerHTML = `
            <p style="text-align: center; color: #ff6b6b;">
                ⚠️ 번역 중 오류가 발생했습니다: ${escapeHtml(error.message)}
            </p>
        `;
    }
}

// 전역 스코프에 함수 노출
window.loadChapter = loadChapter;
window.translateCurrentChapter = translateCurrentChapter;

// 단어 클릭 이벤트 핸들러 (이벤트 위임을 사용)
document.addEventListener('DOMContentLoaded', function() {
    const viewerSection = document.getElementById('original-text-viewer');
    if (viewerSection) {
        viewerSection.addEventListener('click', async (event) => {
            // 1. 클릭된 요소가 'word' 클래스를 가진 <span> 태그인지 확인
            if (event.target.tagName === 'SPAN' && event.target.classList.contains('word')) {
                let clickedWord = event.target.textContent.trim(); 

                if (!clickedWord) return;

                // 2. 구두점 제거 및 소문자 변환 (AI 서버 요청 전 데이터 정제)
                const cleanedWord = clickedWord.replace(/[.,!?;:"'"]/g, '').toLowerCase(); 

                try {
                    // 3. 백엔드 AI API 호출 (http://127.0.0.1:11304 주소 사용)
                    const response = await fetch('http://127.0.0.1:11304/api/ai/lookup', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            word: cleanedWord 
                        })
                    });
                    
                    if (!response.ok) {
                        // HTTP 상태 코드가 200번대가 아닐 경우 (404, 500 등)
                        throw new Error('AI API 요청 실패 또는 서버 오류 발생');
                    }

                    const data = await response.json();

                    // 4. AI 결과를 툴팁으로 표시
                    showWordTooltipWithData(event.target, data);

                } catch (error) {
                    console.error("AI 뜻 검색 실패:", error);
                    // 오류 발생 시 간단한 툴팁 표시
                    showErrorTooltip(event.target, error.message);
                }
            }
        });
    }
});

// AI 응답 데이터를 사용하여 툴팁 표시 함수
function showWordTooltipWithData(targetElement, data) {
    // 기존 툴팁이 있으면 제거
    let tooltip = document.querySelector('.word-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'word-tooltip';
        document.body.appendChild(tooltip);
    }

    // 단어가 이미 저장되어 있는지 확인
    const savedWords = JSON.parse(localStorage.getItem('savedVocabulary') || '[]');
    const wordKey = (data.word || '').toLowerCase().trim();
    const isSaved = savedWords.some(w => w.word && w.word.toLowerCase().trim() === wordKey);
    
    // 단어 데이터를 JSON으로 저장 (data-* 속성에 저장)
    const wordDataJson = JSON.stringify({
        word: data.word || wordKey,
        pronunciation: data.pronunciation || '발음 정보 없음',
        meaning: data.meaning || '의미 정보 없음',
        example: data.example || '예문 정보 없음'
    });
    
    // AI 응답 데이터로 툴팁 내용 구성 (즐겨찾기 버튼 포함)
    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';
    
    const titleH5 = document.createElement('h5');
    titleH5.style.margin = '0';
    titleH5.textContent = data.word || '단어';
    headerDiv.appendChild(titleH5);
    
    // 즐겨찾기 버튼 생성
    const favoriteBtn = document.createElement('button');
    favoriteBtn.id = 'favorite-word-btn';
    favoriteBtn.className = 'favorite-word-btn';
    favoriteBtn.setAttribute('data-word', wordKey);
    favoriteBtn.setAttribute('data-word-info', wordDataJson);
    favoriteBtn.setAttribute('data-saved', isSaved ? 'true' : 'false');
    // 배경은 항상 투명, 테두리는 얇은 회색으로 설정
    favoriteBtn.style.cssText = `background: transparent; border: 1px solid #ddd; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; padding: 0; pointer-events: auto; z-index: 1000; position: relative;`;
    favoriteBtn.title = isSaved ? '단어장에서 제거' : '단어장에 추가';
    favoriteBtn.type = 'button'; // form 제출 방지
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', isSaved ? '#ffd700' : 'none');
    svg.setAttribute('stroke', isSaved ? '#ffd700' : '#666');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2');
    svg.appendChild(polygon);
    favoriteBtn.appendChild(svg);
    
    headerDiv.appendChild(favoriteBtn);
    
    // 툴팁 내용 구성
    tooltip.innerHTML = '';
    tooltip.appendChild(headerDiv);
    
    // 디버깅: 버튼이 제대로 추가되었는지 확인
    console.log('🔍 즐겨찾기 버튼 생성 완료:', {
        button: favoriteBtn,
        inTooltip: tooltip.contains(favoriteBtn),
        word: wordKey,
        isSaved: isSaved
    });
    
    const pronunciationP = document.createElement('p');
    pronunciationP.innerHTML = `<strong>발음</strong>: ${escapeHtml(data.pronunciation || '발음 정보 없음')}`;
    tooltip.appendChild(pronunciationP);
    
    const meaningP = document.createElement('p');
    meaningP.innerHTML = `<strong>뜻</strong>: ${escapeHtml(data.meaning || '의미 정보 없음')}`;
    tooltip.appendChild(meaningP);
    
    const exampleP = document.createElement('p');
    exampleP.innerHTML = `<strong>예문</strong>: ${escapeHtml(data.example || '예문 정보 없음')}`;
    tooltip.appendChild(exampleP);
    
    // 즐겨찾기 버튼 이벤트 리스너 추가 (여러 방법으로 처리)
    const handleFavoriteClick = function(e) {
        e.stopPropagation();
        e.preventDefault();
        
        console.log('⭐ 즐겨찾기 버튼 클릭됨');
        
        // this 대신 favoriteBtn 직접 사용
        const btn = favoriteBtn;
        
        const wordInfoJson = btn.getAttribute('data-word-info');
        if (!wordInfoJson) {
            console.error('❌ 단어 정보를 찾을 수 없습니다.');
            return;
        }
        
        const wordInfo = JSON.parse(wordInfoJson);
        const word = btn.getAttribute('data-word');
        const isCurrentlySaved = btn.getAttribute('data-saved') === 'true';
        
        console.log('📝 단어 정보:', wordInfo);
        console.log('💾 현재 저장 상태:', isCurrentlySaved);
        
        // SVG 요소 다시 찾기
        const btnSvg = btn.querySelector('svg');
        if (!btnSvg) {
            console.error('❌ SVG 요소를 찾을 수 없습니다.');
            return;
        }
        
        // localStorage 직접 조작 (함수가 없을 경우를 대비)
        const savedWords = JSON.parse(localStorage.getItem('savedVocabulary') || '[]');
        const wordKey = word.toLowerCase().trim();
        
        if (isCurrentlySaved) {
            // 단어장에서 제거
            console.log('🗑️ 단어장에서 제거 시작:', word);
            
            const filteredWords = savedWords.filter(w => {
                const wKey = w.word ? w.word.toLowerCase().trim() : '';
                return wKey !== wordKey;
            });
            
            localStorage.setItem('savedVocabulary', JSON.stringify(filteredWords));
            console.log('✅ 단어장에서 제거 완료');
            
            // 전역 함수가 있으면 호출
            if (typeof window.removeWordFromVocabulary === 'function') {
                window.removeWordFromVocabulary(word);
            }
            
            // UI 업데이트 - 배경은 항상 투명, 별만 빈 상태로
            btn.setAttribute('data-saved', 'false');
            btn.style.background = 'transparent';
            btn.style.borderColor = '#ddd';
            btnSvg.setAttribute('fill', 'none');
            btnSvg.setAttribute('stroke', '#666');
            btn.title = '단어장에 추가';
        } else {
            // 단어장에 추가
            console.log('➕ 단어장에 추가 시작:', wordInfo);
            
            const existingIndex = savedWords.findIndex(w => w.word && w.word.toLowerCase().trim() === wordKey);
            
            if (existingIndex >= 0) {
                // 이미 존재하면 업데이트
                savedWords[existingIndex] = {
                    ...wordInfo,
                    savedAt: Date.now()
                };
            } else {
                // 새로 추가
                savedWords.push({
                    ...wordInfo,
                    savedAt: Date.now()
                });
            }
            
            localStorage.setItem('savedVocabulary', JSON.stringify(savedWords));
            console.log('✅ 단어장에 저장 완료. 저장된 단어 수:', savedWords.length);
            
            // 전역 함수가 있으면 호출
            if (typeof window.saveWordToVocabulary === 'function') {
                window.saveWordToVocabulary(wordInfo);
            }
            
            // 단어장 새로고침 (전역 함수가 있으면)
            if (typeof window.loadSavedVocabulary === 'function') {
                window.loadSavedVocabulary();
            }
            
            // UI 업데이트 - 배경은 항상 투명, 별만 노란색으로 채움
            btn.setAttribute('data-saved', 'true');
            btn.style.background = 'transparent';
            btn.style.borderColor = '#ddd';
            btnSvg.setAttribute('fill', '#ffd700');
            btnSvg.setAttribute('stroke', '#ffd700');
            btn.title = '단어장에서 제거';
        }
        
        console.log('📚 현재 단어장:', JSON.parse(localStorage.getItem('savedVocabulary') || '[]'));
    };
    
    // 여러 방법으로 이벤트 리스너 추가
    favoriteBtn.addEventListener('click', handleFavoriteClick, true); // capture phase
    favoriteBtn.addEventListener('click', handleFavoriteClick, false); // bubble phase
    favoriteBtn.onclick = handleFavoriteClick; // 직접 onclick도 설정
    
    // 툴팁에도 이벤트 위임 추가
    tooltip.addEventListener('click', function(e) {
        if (e.target.closest('.favorite-word-btn') || e.target.closest('#favorite-word-btn')) {
            e.stopPropagation();
            handleFavoriteClick.call(favoriteBtn, e);
        }
    });

    // 툴팁 위치 계산
    const rect = targetElement.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const top = window.scrollY + rect.top - tooltipRect.height - 12;
    const left = window.scrollX + rect.left + (rect.width / 2) - (tooltipRect.width / 2);

    // 화면 밖으로 나가지 않도록 조정
    const maxLeft = window.innerWidth - tooltipRect.width - 12;
    const finalLeft = Math.max(12, Math.min(left, maxLeft));
    const finalTop = Math.max(12, top);

    tooltip.style.top = `${finalTop}px`;
    tooltip.style.left = `${finalLeft}px`;

    // 툴팁 표시
    requestAnimationFrame(() => {
        tooltip.classList.add('visible');
    });

    // 다른 곳 클릭 시 툴팁 숨기기
    const hideTooltip = (e) => {
        // 즐겨찾기 버튼 클릭은 무시 (버튼 자체와 SVG, polygon 요소 모두)
        if (e.target.closest('.favorite-word-btn') || 
            e.target.closest('#favorite-word-btn') ||
            e.target.classList.contains('favorite-word-btn') ||
            e.target.id === 'favorite-word-btn' ||
            e.target.closest('button') === favoriteBtn) {
            return;
        }
        
        if (!tooltip.contains(e.target) && e.target !== targetElement) {
            tooltip.classList.remove('visible');
            document.removeEventListener('click', hideTooltip);
        }
    };
    
    // 기존 리스너 제거 후 새로 추가 (약간의 지연을 두어 버튼 클릭이 먼저 처리되도록)
    document.removeEventListener('click', hideTooltip);
    setTimeout(() => {
        document.addEventListener('click', hideTooltip, true); // capture phase에서도 처리
    }, 200);
}

// 오류 툴팁 표시 함수
function showErrorTooltip(targetElement, errorMessage) {
    let tooltip = document.querySelector('.word-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'word-tooltip';
        document.body.appendChild(tooltip);
    }

    tooltip.innerHTML = `
        <h5 style="color: #ff6b6b;">오류</h5>
        <p style="color: #666;">${escapeHtml(errorMessage)}</p>
    `;

    const rect = targetElement.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const top = window.scrollY + rect.top - tooltipRect.height - 12;
    const left = window.scrollX + rect.left + (rect.width / 2) - (tooltipRect.width / 2);

    const maxLeft = window.innerWidth - tooltipRect.width - 12;
    const finalLeft = Math.max(12, Math.min(left, maxLeft));
    const finalTop = Math.max(12, top);

    tooltip.style.top = `${finalTop}px`;
    tooltip.style.left = `${finalLeft}px`;

    requestAnimationFrame(() => {
        tooltip.classList.add('visible');
    });

    // 3초 후 자동으로 숨기기
    setTimeout(() => {
        tooltip.classList.remove('visible');
    }, 3000);
}

