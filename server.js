// server.js
// LitConnect Backend Server for API Integration

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 11304;

// HTTP 서버 생성 및 Socket.io 초기화
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ['http://127.0.0.1:11304', 'http://localhost:11304'],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// 미들웨어 설정
app.use(cors({
    origin: ['http://127.0.0.1:11304', 'http://localhost:11304'],
    credentials: true // 세션 쿠키를 위해 필요
})); // CORS 허용
app.use(express.json()); // JSON 파싱
app.use(express.urlencoded({ extended: true })); // URL 인코딩된 데이터 파싱

// 세션 미들웨어 설정
app.use(session({
    secret: process.env.SESSION_SECRET || 'litconnect-session-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // HTTPS 사용 시 true로 변경
        httpOnly: true,
        maxAge: 10 * 60 * 1000 // 10분 (state 만료 시간과 동일)
    }
}));

// 환경 변수 확인
const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const MONGO_URI = process.env.MONGO_URI;

// @google/genai 라이브러리 import
const { GoogleGenAI } = require('@google/genai');

// Gemini API 키 확인 및 초기화
if (!GEMINI_API_KEY) {
    console.error("오류: GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const model = "gemini-2.5-flash"; // 빠르고 효율적인 모델 선택

// Spotify Access Token 캐시
// 발급받은 Access Token과 만료 시간을 저장할 변수
let spotifyAccessToken = null;
let tokenExpirationTime = 0;

// ============================================
// MongoDB 연결 설정
// ============================================

// MongoDB 연결
if (!MONGO_URI) {
    console.error('❌ MONGO_URI 환경 변수가 설정되지 않았습니다.');
    console.log('⚠️  .env 파일에 MONGO_URI를 설정해주세요.');
} else {
    mongoose.connect(MONGO_URI, {
        dbName: 'LitConnect_DB'
    })
    .then(() => {
        console.log('✅ MongoDB 연결 성공');
    })
    .catch((err) => {
        console.error('❌ MongoDB 연결 오류:', err.message);
        console.error('❌ 오류 상세:', err);
        
        // 인증 오류인 경우 특별 안내
        if (err.message.includes('bad auth') || err.message.includes('Authentication failed')) {
            console.error('\n⚠️  MongoDB 인증 오류가 발생했습니다.');
            console.error('다음 사항을 확인해주세요:');
            console.error('1. MongoDB Atlas에서 사용자 비밀번호가 변경되지 않았는지 확인');
            console.error('2. .env 파일의 MONGO_URI 연결 문자열이 올바른지 확인');
            console.error('3. 비밀번호에 특수문자(@, #, $ 등)가 있으면 URL 인코딩이 필요합니다');
            console.error('   예: @ -> %40, # -> %23, $ -> %24');
            console.error('4. MongoDB Atlas의 Network Access에서 현재 IP가 허용되어 있는지 확인');
            console.error('5. MongoDB Atlas에서 Database Access에서 사용자 권한이 올바른지 확인');
        }
        
        console.log('⚠️  MongoDB 연결 없이 서버가 시작됩니다.');
    });
}

// Book 스키마 정의 (MongoDB에 저장된 구조에 맞춤)
const chapterSchema = new mongoose.Schema({
    chapter_number: Number,
    chapter_title: String,
    content: String,
    text_content: String  // text_content 필드도 지원
}, { _id: false });

const bookSchema = new mongoose.Schema({
    book_title: String,
    author: String,
    total_chapters: Number,
    chapters: [chapterSchema],
    inserted_at: Date
}, { collection: 'books' });

const Book = mongoose.model('Book', bookSchema);

// 루트 경로 - index.html 제공
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API 가이드 엔드포인트
app.get('/api', (req, res) => {
    res.json({
        message: 'LitConnect Backend Server',
        version: '1.0.0',
        endpoints: {
            '/api/translate': 'POST - DeepL 번역 API',
            '/api/correct': 'POST - Gemini 영어 교정 API',
            '/api/summarize': 'POST - Gemini 줄거리 요약 API',
            '/api/topics': 'POST - Gemini 토론 주제 생성 API',
            '/api/vocabulary': 'POST - Gemini 단어장 생성 API',
            '/api/ai/lookup': 'POST - Gemini 단어 조회 API',
            '/api/spotify/login': 'GET - Spotify 로그인 (Authorization Code Flow)',
            '/api/spotify/search': 'GET - Spotify 검색 API',
            '/api/spotify/play': 'POST - Spotify 재생 API',
            '/api/book/chapter/:bookTitle/:chapterNumber': 'GET - 책 챕터 내용 조회 API',
            '/api/health': 'GET - 서버 상태 확인'
        }
    });
});

// 서버 상태 확인
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        deepl_configured: !!DEEPL_API_KEY && !DEEPL_API_KEY.includes('발급받은'),
        gemini_configured: !!GEMINI_API_KEY && !GEMINI_API_KEY.includes('발급받은'),
        spotify_configured: !!SPOTIFY_CLIENT_ID && !!SPOTIFY_CLIENT_SECRET,
        mongodb_connected: mongoose.connection.readyState === 1
    });
});

// ============================================
// MongoDB API 엔드포인트
// ============================================

/**
 * GET /api/book/chapter/:bookTitle/:chapterNumber
 * 책 제목과 챕터 번호로 챕터 내용 조회
 */
app.get('/api/book/chapter/:bookTitle/:chapterNumber', async (req, res) => {
    try {
        // MongoDB 연결 확인
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({
                error: 'MongoDB 연결이 되지 않았습니다.',
                message: '데이터베이스 연결을 확인해주세요.'
            });
        }

        // URL 파라미터에서 책 제목과 챕터 번호 추출
        const bookTitle = decodeURIComponent(req.params.bookTitle);
        const chapterNumber = parseInt(req.params.chapterNumber, 10);

        // 파라미터 유효성 검사
        if (!bookTitle || isNaN(chapterNumber) || chapterNumber < 1) {
            return res.status(400).json({
                error: '잘못된 요청 파라미터',
                message: 'bookTitle과 chapterNumber(양수)를 올바르게 입력해주세요.'
            });
        }

        // MongoDB에서 책 조회
        const book = await Book.findOne({ book_title: bookTitle });

        if (!book) {
            return res.status(404).json({
                error: '책을 찾을 수 없습니다',
                message: `'${bookTitle}' 책이 데이터베이스에 없습니다.`
            });
        }

        // 챕터 찾기
        const chapter = book.chapters.find(
            ch => ch.chapter_number === chapterNumber
        );

        if (!chapter) {
            return res.status(404).json({
                error: '챕터를 찾을 수 없습니다',
                message: `'${bookTitle}'의 ${chapterNumber}번 챕터가 없습니다.`,
                total_chapters: book.total_chapters
            });
        }

        // text_content가 있으면 우선 사용, 없으면 content 사용
        const textContent = chapter.text_content || chapter.content;

        if (!textContent) {
            return res.status(404).json({
                error: '챕터 내용이 없습니다',
                message: '해당 챕터에 내용이 없습니다.'
            });
        }

        // 성공 응답
        res.json({
            book_title: book.book_title,
            author: book.author,
            chapter_number: chapter.chapter_number,
            chapter_title: chapter.chapter_title,
            text_content: textContent,
            total_chapters: book.total_chapters || null // 전체 챕터 수 추가
        });

    } catch (error) {
        console.error('챕터 조회 오류:', error);
        res.status(500).json({
            error: '서버 오류',
            message: '챕터 조회 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// ============================================
// Spotify API 연동 함수들
// ============================================

/**
 * Spotify Access Token을 발급받거나 저장된 토큰을 반환합니다.
 * Client Credentials Flow 사용
 * @returns {Promise<string|null>} Access Token
 */
async function getSpotifyAccessToken() {
    // 1. 토큰 만료 시간 확인 (현재 시간이 만료 시간보다 크거나 토큰이 없으면 재발급)
    if (spotifyAccessToken && Date.now() < tokenExpirationTime) {
        return spotifyAccessToken; // 캐시된 토큰 사용
    }

    // Spotify API 키 확인
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
        console.error('Spotify Client ID 또는 Client Secret이 설정되지 않았습니다.');
        return null;
    }

    // 2. Client ID와 Secret을 Base64 인코딩
    const credentials = Buffer.from(
        `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
    ).toString('base64');

    try {
        // 3. Spotify Token 엔드포인트에 POST 요청
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${credentials}` // Base64 인코딩된 인증 정보
            },
            // Client Credentials Flow의 필수 본문
            body: 'grant_type=client_credentials'
        });

        if (!response.ok) {
            throw new Error(`Spotify API Token 발급 실패: ${response.statusText}`);
        }

        const data = await response.json();

        // 4. 발급받은 토큰 및 만료 시간 저장 (캐싱)
        spotifyAccessToken = data.access_token;
        // 토큰 만료 시간 계산 (만료 시간은 초 단위이므로 밀리초로 변환 후 1분(60초) 일찍 만료되도록 설정)
        tokenExpirationTime = Date.now() + (data.expires_in - 60) * 1000;

        console.log('✅ Spotify Access Token 발급 및 캐싱 성공.');
        return spotifyAccessToken;

    } catch (error) {
        console.error('Spotify Access Token 발급 중 오류 발생:', error.message);
        // 오류 발생 시 null 반환
        return null;
    }
}

/**
 * 예시: Spotify 검색 API에 접근하는 함수 구조
 * @param {string} query 검색어 (예: 'Moonlight Sonata')
 * @param {string} type 검색 타입 (track, album, artist 등, 기본값: 'track')
 * @param {number} limit 결과 개수 (기본값: 5)
 * @returns {Promise<Object>} 검색 결과
 */
async function searchSpotify(query, type = 'track', limit = 5) {
    const token = await getSpotifyAccessToken();

    if (!token) {
        console.log('Access Token이 없어 Spotify 검색을 수행할 수 없습니다.');
        return { error: '토큰 인증 실패' };
    }

    try {
        const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}` // 발급받은 Access Token 사용
            }
        });

        if (!response.ok) {
            throw new Error(`Spotify 검색 API 호출 실패: ${response.statusText}`);
        }

        const data = await response.json();
        
        // 검색 타입에 따라 적절한 결과 반환
        if (type === 'track') {
            return data.tracks?.items || []; // 검색 결과 트랙 목록 반환
        } else if (type === 'album') {
            return data.albums?.items || [];
        } else if (type === 'artist') {
            return data.artists?.items || [];
        } else {
            return data; // 전체 결과 반환
        }
    } catch (error) {
        console.error('Spotify 검색 중 오류 발생:', error.message);
        return { error: 'Spotify 검색 오류' };
    }
}

/**
 * Spotify Authorization Code Flow 시작 엔드포인트
 * GET /api/spotify/login
 * 
 * 사용자를 Spotify 로그인/동의 페이지로 리디렉션합니다.
 * 인증 성공 후 http://127.0.0.1:11304/callback으로 돌아옵니다.
 */
app.get('/api/spotify/login', (req, res) => {
    try {
        // Spotify API 키 확인
        if (!SPOTIFY_CLIENT_ID) {
            return res.status(500).json({
                success: false,
                error: 'Spotify Client ID가 설정되지 않았습니다.',
                message: '.env 파일에 SPOTIFY_CLIENT_ID를 설정해주세요.'
            });
        }

        // 리디렉션 URI 설정
        const redirectUri = 'http://127.0.0.1:11304/callback';

        // CSRF 보호를 위한 state 파라미터 생성 (랜덤 문자열)
        const crypto = require('crypto');
        const state = crypto.randomBytes(16).toString('hex');

        // 세션에 state 저장 (나중에 콜백에서 검증하기 위해)
        req.session.state = state;

        // Spotify 권한 범위 (Scope) 설정
        // ⚠️ 중요: streaming과 user-modify-playback-state는 재생 기능에 필수입니다!
        // 이 두 권한이 없으면 음악 재생이 불가능합니다.
        const scopes = [
            // ============================================
            // Web Playback SDK 필수 스코프 (재생 기능 필수!)
            // ============================================
            'streaming',                      // 음악 스트리밍 권한 (필수! 없으면 재생 불가)
            'user-modify-playback-state',     // 재생 제어 권한 (필수! 없으면 재생 불가)
            'user-read-playback-state',       // 재생 상태 읽기 권한
            
            // ============================================
            // 추가 기능 스코프
            // ============================================
            'user-read-private',              // 사용자 프로필 정보 읽기
            'user-read-email',                // 사용자 이메일 읽기
            'user-library-read',              // 사용자 저장된 음악 읽기
            'user-library-modify',            // 사용자 저장된 음악 수정
            'playlist-read-private',          // 사용자 개인 플레이리스트 읽기
            'playlist-modify-public',         // 공개 플레이리스트 수정
            'playlist-modify-private'         // 개인 플레이리스트 수정
        ].join(' ');

        // Spotify Authorization URL 생성
        const authUrl = new URL('https://accounts.spotify.com/authorize');
        authUrl.searchParams.append('client_id', SPOTIFY_CLIENT_ID);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('redirect_uri', redirectUri);
        authUrl.searchParams.append('scope', scopes);
        authUrl.searchParams.append('state', state);
        authUrl.searchParams.append('show_dialog', 'false'); // 이미 동의한 경우 다이얼로그 표시 여부

        // 세션 저장 후 리디렉션
        req.session.save((err) => {
            if (err) {
                console.error('세션 저장 오류:', err);
                return res.status(500).json({
                    success: false,
                    error: '세션 저장 실패',
                    message: '세션을 저장할 수 없습니다.'
                });
            }
            // 사용자를 Spotify 로그인 페이지로 리디렉션
            res.redirect(authUrl.toString());
        });

    } catch (error) {
        console.error('Spotify 로그인 리디렉션 오류:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류',
            message: error.message || 'Spotify 로그인 페이지로 리디렉션할 수 없습니다.'
        });
    }
});

/**
 * Spotify Authorization Code를 Access Token으로 교환하는 콜백 엔드포인트
 * GET /callback
 * 
 * Spotify 로그인 후 리디렉션되는 엔드포인트입니다.
 * Authorization Code를 Access Token으로 교환하여 프론트엔드로 전달합니다.
 */
app.get('/callback', async (req, res) => {
    try {
        const { code, state, error } = req.query;

        // 에러 처리
        if (error) {
            console.error('Spotify 인증 오류:', error);
            return res.send(`
                <!DOCTYPE html>
                <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>Spotify 로그인 실패</title>
                    </head>
                    <body>
                        <h1>Spotify 로그인 실패</h1>
                        <p>오류: ${error}</p>
                        <script>
                            if (window.opener) {
                                window.opener.postMessage({ type: 'spotify-auth-error', error: '${error}' }, 'http://127.0.0.1:11304');
                                window.close();
                            }
                        </script>
                    </body>
                </html>
            `);
        }

        // code가 없으면 에러
        if (!code) {
            return res.send(`
                <!DOCTYPE html>
                <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>인증 오류</title>
                    </head>
                    <body>
                        <h1>인증 코드를 받을 수 없습니다</h1>
                        <script>
                            if (window.opener) {
                                window.opener.postMessage({ type: 'spotify-auth-error', error: 'No authorization code' }, 'http://127.0.0.1:11304');
                                window.close();
                            }
                        </script>
                    </body>
                </html>
            `);
        }

        // state 검증 (CSRF 보호)
        // 세션에 저장된 state와 URL로 전달받은 state 비교
        if (!req.session.state) {
            console.error('세션에 state가 없습니다.');
            return res.send(`
                <!DOCTYPE html>
                <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>인증 오류</title>
                    </head>
                    <body>
                        <h1>인증 오류</h1>
                        <p>세션에 state가 저장되지 않았습니다. 다시 로그인해주세요.</p>
                        <script>
                            if (window.opener) {
                                window.opener.postMessage({ type: 'spotify-auth-error', error: 'Session state not found' }, 'http://127.0.0.1:11304');
                                window.close();
                            }
                        </script>
                    </body>
                </html>
            `);
        }

        if (req.session.state !== state) {
            console.error('State 불일치:', {
                sessionState: req.session.state,
                receivedState: state
            });
            return res.send(`
                <!DOCTYPE html>
                <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>인증 오류</title>
                    </head>
                    <body>
                        <h1>인증 오류</h1>
                        <p>유효하지 않은 state 파라미터입니다. CSRF 공격 가능성이 있습니다.</p>
                        <script>
                            if (window.opener) {
                                window.opener.postMessage({ type: 'spotify-auth-error', error: 'Invalid state' }, 'http://127.0.0.1:11304');
                                window.close();
                            }
                        </script>
                    </body>
                </html>
            `);
        }

        // 사용된 state 제거 (일회용)
        delete req.session.state;
        req.session.save((err) => {
            if (err) {
                console.error('세션 저장 오류:', err);
            }
        });

        // Authorization Code를 Access Token으로 교환
        const redirectUri = 'http://127.0.0.1:11304/callback';
        const credentials = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri
            })
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            throw new Error(errorData.error_description || '토큰 교환 실패');
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        const refreshToken = tokenData.refresh_token;
        const expiresIn = tokenData.expires_in;

        // 팝업 창인 경우 부모 창으로 메시지를 보내고 창을 닫음
        // 일반 창인 경우 메인 페이지로 리디렉션
        return res.send(`
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Spotify 로그인 완료</title>
                </head>
                <body>
                    <h1>로그인 완료</h1>
                    <p>잠시만 기다려주세요...</p>
                    <script>
                        if (window.opener) {
                            // 팝업 창인 경우: 부모 창으로 토큰 전달하고 창 닫기
                            window.opener.postMessage({
                                type: 'spotify-auth-success',
                                accessToken: '${accessToken}',
                                refreshToken: '${refreshToken}',
                                expiresIn: ${expiresIn}
                            }, 'http://127.0.0.1:11304');
                            window.close();
                        } else {
                            // 일반 창인 경우: 메인 페이지로 리디렉션
                            window.location.href = 'http://127.0.0.1:11304/index.html?access_token=${accessToken}&refresh_token=${refreshToken}&expires_in=${expiresIn}';
                        }
                    </script>
                </body>
            </html>
        `);

    } catch (error) {
        console.error('Spotify 콜백 처리 오류:', error);
        res.send(`
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8">
                    <title>오류 발생</title>
                </head>
                <body>
                    <h1>오류 발생</h1>
                    <p>${error.message}</p>
                    <script>
                        if (window.opener) {
                            window.opener.postMessage({ type: 'spotify-auth-error', error: '${error.message.replace(/'/g, "\\'")}' }, 'http://127.0.0.1:11304');
                            window.close();
                        }
                    </script>
                </body>
            </html>
        `);
    }
});

/**
 * Spotify 검색 API 엔드포인트
 * GET /api/spotify/search
 * 
 * 쿼리 파라미터:
 * - q (필수): 검색어
 * - type (선택): 검색 타입 (track, album, artist 등, 기본값: 'track')
 * - limit (선택): 결과 개수 (기본값: 20)
 * 
 * 동작 방식:
 * 1. getSpotifyAccessToken()을 사용하여 Access Token 발급
 * 2. 발급받은 토큰으로 Spotify /v1/search API 호출
 * 3. 검색 결과를 JSON 형태로 반환
 */
app.get('/api/spotify/search', async (req, res) => {
    try {
        // 쿼리 파라미터에서 검색어 추출
        const { q, type = 'track', limit = 20 } = req.query;

        // 입력 검증: 검색어(q)는 필수
        if (!q || !q.trim()) {
            return res.status(400).json({
                success: false,
                error: '검색어가 필요합니다.',
                message: 'q 쿼리 파라미터는 필수입니다.'
            });
        }

        // Spotify API 키 확인
        if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
            return res.status(500).json({
                success: false,
                error: 'Spotify API 키가 설정되지 않았습니다.',
                message: '.env 파일에 SPOTIFY_CLIENT_ID와 SPOTIFY_CLIENT_SECRET을 설정해주세요.'
            });
        }

        // getSpotifyAccessToken()을 사용하여 Access Token 발급
        // searchSpotify() 함수 내부에서 토큰을 발급받고 Spotify /v1/search API로 요청
        const searchResults = await searchSpotify(q.trim(), type, parseInt(limit));

        // 에러 체크
        if (searchResults.error) {
            return res.status(500).json({
                success: false,
                error: searchResults.error,
                message: 'Spotify 검색을 수행할 수 없습니다.'
            });
        }

        // 검색 결과를 JSON 형태로 반환
        res.json({
            success: true,
            query: q.trim(),
            type: type,
            limit: parseInt(limit),
            results: searchResults
        });

    } catch (error) {
        console.error('Spotify 검색 API 오류:', error);

        // 에러 응답 처리
        res.status(500).json({
            success: false,
            error: '서버 오류',
            message: error.message || '알 수 없는 오류가 발생했습니다.'
        });
    }
});

/**
 * Spotify 재생 API 엔드포인트
 * POST /api/spotify/play
 * 
 * 요청 Body:
 * - device_id (필수): Spotify Web Playback SDK에서 획득한 디바이스 ID
 * - uri (필수): 재생할 트랙의 Spotify URI (예: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh')
 * 
 * 요청 Headers:
 * - Authorization: Bearer {access_token} (클라이언트에서 전달)
 * 
 * 동작 방식:
 * 1. 클라이언트로부터 device_id, uri, access_token을 받음
 * 2. Spotify Web API의 PUT /v1/me/player/play 엔드포인트에 요청
 * 3. device_id를 쿼리 매개변수로, uri를 Body에 담아 전송
 */
app.post('/api/spotify/play', async (req, res) => {
    try {
        // 요청 Body에서 device_id와 uri 추출
        const { device_id, uri } = req.body;

        // 입력 검증
        if (!device_id || !device_id.trim()) {
            return res.status(400).json({
                success: false,
                error: 'device_id가 필요합니다.',
                message: 'device_id는 필수입니다.'
            });
        }

        if (!uri || !uri.trim()) {
            return res.status(400).json({
                success: false,
                error: 'uri가 필요합니다.',
                message: 'uri는 필수입니다.'
            });
        }

        // Authorization 헤더에서 Access Token 추출
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: '인증 토큰이 필요합니다.',
                message: 'Authorization 헤더에 Bearer 토큰을 포함해주세요.'
            });
        }

        const accessToken = authHeader.substring(7); // 'Bearer ' 제거

        // Spotify Web API의 PUT /v1/me/player/play 엔드포인트에 요청
        const spotifyResponse = await axios.put(
            `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(device_id.trim())}`,
            {
                uris: [uri.trim()]
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Spotify API 응답이 성공적이면 클라이언트에 성공 응답 반환
        res.json({
            success: true,
            message: '트랙 재생 요청이 성공적으로 전송되었습니다.',
            device_id: device_id.trim(),
            uri: uri.trim()
        });

    } catch (error) {
        console.error('Spotify 재생 API 오류:', error);

        // Spotify API 에러 응답 처리
        if (error.response) {
            const statusCode = error.response.status;
            const errorData = error.response.data || {};
            
            return res.status(statusCode).json({
                success: false,
                error: errorData.error?.message || 'Spotify API 오류',
                message: errorData.error?.message || `Spotify API 오류: ${statusCode}`,
                spotify_error: errorData.error
            });
        }

        // 네트워크 오류 등 기타 오류
        res.status(500).json({
            success: false,
            error: '서버 오류',
            message: error.message || '알 수 없는 오류가 발생했습니다.'
        });
    }
});

// DeepL 번역 API 엔드포인트
app.post('/api/translate', async (req, res) => {
    try {
        // req.body에서 text, target_lang, source_lang 추출
        const { text, target_lang, source_lang } = req.body;

        // 입력 검증
        if (!text || !text.trim()) {
            return res.status(400).json({
                success: false,
                error: '번역할 텍스트가 필요합니다.',
                message: 'text 필드는 필수입니다.'
            });
        }

        if (!target_lang) {
            return res.status(400).json({
                success: false,
                error: '목표 언어가 필요합니다.',
                message: 'target_lang 필드는 필수입니다.'
            });
        }

        // DeepL API 키 확인
        if (!DEEPL_API_KEY || DEEPL_API_KEY.includes('발급받은')) {
            return res.status(500).json({
                success: false,
                error: 'DeepL API 키가 설정되지 않았습니다.',
                message: '.env 파일에 DEEPL_API_KEY를 설정해주세요.'
            });
        }

        // DeepL API 엔드포인트 결정 (Free 또는 Pro)
        // Free 플랜 API 키는 'fx'로 시작
        const deeplEndpoint = DEEPL_API_KEY.endsWith(':fx') || DEEPL_API_KEY.startsWith('fx')
            ? 'https://api-free.deepl.com/v2/translate'
            : 'https://api.deepl.com/v2/translate';

        // source_lang 처리: 프론트엔드에서 'auto'로 넘어오면 'EN'으로 설정, 아니면 받은 값 사용
        // target_lang이 'EN'인 경우 (영어 번역 요청) source_lang을 'KO'로 설정
        let finalSourceLang;
        if (target_lang.toUpperCase() === 'EN') {
            // 영어 번역 요청인 경우: 한국어 -> 영어로 고정
            finalSourceLang = 'KO';
        } else if (source_lang && source_lang !== 'auto') {
            // 프론트엔드에서 명시적으로 source_lang을 보낸 경우
            finalSourceLang = source_lang.toUpperCase();
        } else {
            // 기본값: 영어로 설정
            finalSourceLang = 'EN';
        }

        // DeepL API 요청 본문 구성
        const requestParams = new URLSearchParams({
            auth_key: DEEPL_API_KEY,
            text: text.trim(),
            source_lang: finalSourceLang,
            target_lang: target_lang.toUpperCase()
        });

        // DeepL API 호출
        const response = await axios.post(
            deeplEndpoint,
            requestParams,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        // 응답 처리
        if (response.data && response.data.translations && response.data.translations.length > 0) {
            // 번역 결과를 프론트엔드에 반환
            res.json({
                success: true,
                translatedText: response.data.translations[0].text,
                source_lang: finalSourceLang,
                target_lang: target_lang.toUpperCase()
            });
        } else {
            throw new Error('번역 결과가 없습니다.');
        }

    } catch (error) {
        console.error('DeepL 번역 오류:', error);

        // 에러 응답 처리
        if (error.response) {
            // DeepL API에서 반환한 에러
            const errorMessage = error.response.data?.message || error.message;
            console.error('DeepL API 에러 응답:', error.response.data);
            
            res.status(error.response.status || 500).json({
                success: false,
                error: 'DeepL API 오류',
                message: errorMessage,
                statusCode: error.response.status
            });
        } else if (error.request) {
            // 요청은 보냈지만 응답을 받지 못함
            res.status(503).json({
                success: false,
                error: '서비스 연결 오류',
                message: 'DeepL API에 연결할 수 없습니다.'
            });
        } else {
            // 요청 설정 중 오류 발생
            res.status(500).json({
                success: false,
                error: '서버 오류',
                message: error.message || '알 수 없는 오류가 발생했습니다.'
            });
        }
    }
});

// Gemini 영어 교정 API 엔드포인트
app.post('/api/correct', async (req, res) => {
    try {
        // req.body에서 englishText와 targetLang 추출
        const { englishText, targetLang } = req.body;

        // 입력 검증
        if (!englishText || !englishText.trim()) {
            return res.status(400).json({
                success: false,
                error: '교정할 텍스트가 필요합니다.',
                message: 'englishText 필드는 필수입니다.'
            });
        }

        if (!targetLang) {
            return res.status(400).json({
                success: false,
                error: '목표 언어가 필요합니다.',
                message: 'targetLang 필드는 필수입니다.'
            });
        }

        // Gemini API 키 확인
        if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('발급받은')) {
            return res.status(500).json({
                success: false,
                error: 'Gemini API 키가 설정되지 않았습니다.',
                message: '.env 파일에 GEMINI_API_KEY를 설정해주세요.'
            });
        }

        // targetLang에 따라 프롬프트 동적으로 구성
        let instruction;
        if (targetLang.toUpperCase() === 'EN') {
            instruction = '제공된 영어 텍스트를 문법적으로 교정하고 더 자연스러운 표현으로 다듬어 줘.';
        } else if (targetLang.toUpperCase() === 'KO') {
            instruction = '제공된 영어 텍스트를 한국어로 매우 자연스럽게 번역하고 문맥에 맞게 다듬어 줘.';
        } else {
            // 기본값: 영어 교정
            instruction = '제공된 영어 텍스트를 문법적으로 교정하고 더 자연스러운 표현으로 다듬어 줘.';
        }

        // Gemini API 프롬프트 구성
        const prompt = `${instruction} 결과만 답변해주세요.

원문: ${englishText.trim()}`;

        // Gemini API 엔드포인트
        // 현재 가장 안정적이고 속도가 빠른 모델
        const modelName = 'gemini-2.5-flash';
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

        // Gemini API 호출
        const response = await axios.post(
            geminiEndpoint,
            {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        // 응답 처리
        if (response.data && response.data.candidates && response.data.candidates.length > 0) {
            const candidate = response.data.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                const resultText = candidate.content.parts[0].text.trim();
                
                // 교정/번역 결과를 프론트엔드에 반환
                res.json({
                    success: true,
                    original: englishText.trim(),
                    corrected: resultText,
                    targetLang: targetLang.toUpperCase()
                });
            } else {
                throw new Error('Gemini API 응답 형식이 올바르지 않습니다.');
            }
        } else {
            throw new Error('교정 결과를 받을 수 없습니다.');
        }

    } catch (error) {
        console.error('Gemini 교정 오류:', error);

        // 에러 응답 처리
        if (error.response) {
            // Gemini API에서 반환한 에러
            const errorMessage = error.response.data?.error?.message || error.message;
            const statusCode = error.response.status || 500;
            console.error('Gemini API 에러 응답:', error.response.data);
            
            res.status(statusCode).json({
                success: false,
                error: 'Gemini API 오류',
                message: errorMessage,
                statusCode: statusCode
            });
        } else if (error.request) {
            // 요청은 보냈지만 응답을 받지 못함
            res.status(503).json({
                success: false,
                error: '서비스 연결 오류',
                message: 'Gemini API에 연결할 수 없습니다.'
            });
        } else {
            // 요청 설정 중 오류 발생
            res.status(500).json({
                success: false,
                error: '서버 오류',
                message: error.message || '알 수 없는 오류가 발생했습니다.'
            });
        }
    }
});

// Gemini 줄거리 요약 API 엔드포인트
app.post('/api/summarize', async (req, res) => {
    try {
        // req.body에서 chapterText 추출
        const { chapterText } = req.body;

        // 입력 검증
        if (!chapterText || !chapterText.trim()) {
            return res.status(400).json({
                success: false,
                error: '챕터 텍스트가 필요합니다.',
                message: 'chapterText 필드는 필수입니다.'
            });
        }

        // Gemini API 키 확인
        if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('발급받은')) {
            return res.status(500).json({
                success: false,
                error: 'Gemini API 키가 설정되지 않았습니다.',
                message: '.env 파일에 GEMINI_API_KEY를 설정해주세요.'
            });
        }

        // Gemini API 프롬프트 구성
        const prompt = `제공된 챕터 텍스트를 초급 독자를 위해 3~4문장으로 간결하게 한국어/영어 요약으로 제공하고, 난이도에 따라 요약 언어를 선택할 수 있도록 로직을 구성해 줘. 요약만 답변해주세요.

챕터 텍스트:
${chapterText.trim()}`;

        // Gemini API 엔드포인트
        const modelName = 'gemini-2.5-flash';
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

        // Gemini API 호출
        const response = await axios.post(
            geminiEndpoint,
            {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        // 응답 처리
        if (response.data && response.data.candidates && response.data.candidates.length > 0) {
            const candidate = response.data.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                const summaryText = candidate.content.parts[0].text.trim();
                
                // 요약 결과를 프론트엔드에 반환
                res.json({
                    success: true,
                    summary: summaryText
                });
            } else {
                throw new Error('Gemini API 응답 형식이 올바르지 않습니다.');
            }
        } else {
            throw new Error('요약 결과를 받을 수 없습니다.');
        }

    } catch (error) {
        console.error('Gemini 요약 오류:', error);

        // 에러 응답 처리
        if (error.response) {
            const errorMessage = error.response.data?.error?.message || error.message;
            const statusCode = error.response.status || 500;
            console.error('Gemini API 에러 응답:', error.response.data);
            
            res.status(statusCode).json({
                success: false,
                error: 'Gemini API 오류',
                message: errorMessage,
                statusCode: statusCode
            });
        } else if (error.request) {
            res.status(503).json({
                success: false,
                error: '서비스 연결 오류',
                message: 'Gemini API에 연결할 수 없습니다.'
            });
        } else {
            res.status(500).json({
                success: false,
                error: '서버 오류',
                message: error.message || '알 수 없는 오류가 발생했습니다.'
            });
        }
    }
});

// Gemini 토론 주제 생성 API 엔드포인트
app.post('/api/topics', async (req, res) => {
    try {
        // req.body에서 chapterText 추출
        const { chapterText } = req.body;

        // 입력 검증
        if (!chapterText || !chapterText.trim()) {
            return res.status(400).json({
                success: false,
                error: '챕터 텍스트가 필요합니다.',
                message: 'chapterText 필드는 필수입니다.'
            });
        }

        // Gemini API 키 확인
        if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('발급받은')) {
            return res.status(500).json({
                success: false,
                error: 'Gemini API 키가 설정되지 않았습니다.',
                message: '.env 파일에 GEMINI_API_KEY를 설정해주세요.'
            });
        }

        // Gemini API 프롬프트 구성
        const prompt = `제공된 챕터 텍스트를 기반으로, 심도 있는 비판적 사고를 유도하는 정확히 3가지 토론 주제를 질문 형태로 생성해 줘. 이 주제들은 커뮤니티 토론에 적합해야 해.

**중요 지시사항:**
- 오직 요청한 3가지 토론 주제 질문만 리스트 형태로 출력하세요.
- 어떠한 서론, 결론, 설명, 또는 추가 문장도 포함하지 마세요.
- 출력 형식은 번호가 없는 리스트 (Unordered List) 형태로 정확히 3개의 주제만 생성하세요.
- 출력 예시: [ 주제1 질문, 주제2 질문, 주제3 질문 ]

챕터 텍스트:
${chapterText.trim()}`;

        // Gemini API 엔드포인트
        const modelName = 'gemini-2.5-flash';
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

        // Gemini API 호출
        const response = await axios.post(
            geminiEndpoint,
            {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        // 응답 처리
        if (response.data && response.data.candidates && response.data.candidates.length > 0) {
            const candidate = response.data.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                const topicsText = candidate.content.parts[0].text.trim();
                
                // 토론 주제 결과를 프론트엔드에 반환
                res.json({
                    success: true,
                    topics: topicsText
                });
            } else {
                throw new Error('Gemini API 응답 형식이 올바르지 않습니다.');
            }
        } else {
            throw new Error('토론 주제를 받을 수 없습니다.');
        }

    } catch (error) {
        console.error('Gemini 토론 주제 생성 오류:', error);

        // 에러 응답 처리
        if (error.response) {
            const errorMessage = error.response.data?.error?.message || error.message;
            const statusCode = error.response.status || 500;
            console.error('Gemini API 에러 응답:', error.response.data);
            
            res.status(statusCode).json({
                success: false,
                error: 'Gemini API 오류',
                message: errorMessage,
                statusCode: statusCode
            });
        } else if (error.request) {
            res.status(503).json({
                success: false,
                error: '서비스 연결 오류',
                message: 'Gemini API에 연결할 수 없습니다.'
            });
        } else {
            res.status(500).json({
                success: false,
                error: '서버 오류',
                message: error.message || '알 수 없는 오류가 발생했습니다.'
            });
        }
    }
});

// Gemini 단어장 생성 API 엔드포인트
app.post('/api/vocabulary', async (req, res) => {
    try {
        // req.body에서 words 배열 추출
        const { words } = req.body;

        // 입력 검증
        if (!words || !Array.isArray(words) || words.length === 0) {
            return res.status(400).json({
                success: false,
                error: '단어 목록이 필요합니다.',
                message: 'words 필드는 배열 형태로 필수입니다.'
            });
        }

        // Gemini API 키 확인
        if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('발급받은')) {
            return res.status(500).json({
                success: false,
                error: 'Gemini API 키가 설정되지 않았습니다.',
                message: '.env 파일에 GEMINI_API_KEY를 설정해주세요.'
            });
        }

        // Gemini API 프롬프트 구성
        const prompt = `당신은 영어 학습을 돕는 튜터입니다. 아래의 단어 목록을 참고하여 학습용 단어장을 만들어 주세요.

단어 목록: ${words.join(', ')}

**중요: 인사말, 설명, 소개 문구 없이 바로 단어장 내용만 출력하세요.**

각 단어에 대해 다음 정보를 한국어로 제공하세요:
- 단어 (원문 그대로)
- 발음 (IPA 혹은 쉬운 표기)
- 핵심 의미 (간단 명확)
- 예문 (영어 문장 1개와 한국어 번역 1개)

출력 형식은 보기 좋게 번호를 붙여 정리해주세요. 인사말이나 "안녕하세요", "요청하신", "궁금한 점" 같은 문구는 절대 포함하지 마세요.`;

        // Gemini API 엔드포인트
        const modelName = 'gemini-2.5-flash';
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

        // Gemini API 호출
        const response = await axios.post(
            geminiEndpoint,
            {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        // 응답 처리
        if (response.data && response.data.candidates && response.data.candidates.length > 0) {
            const candidate = response.data.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                let vocabText = candidate.content.parts[0].text.trim();
                
                // 인사말 및 불필요한 설명 제거
                vocabText = vocabText
                    .replace(/^.*?안녕하세요[^]*?요청하신[^]*?궁금한 점[^]*?질문해주세요[^]*?---/gi, '') // 인사말 제거
                    .replace(/^.*?영어 학습 튜터입니다[^]*?---/gi, '') // 설명 제거
                    .replace(/^.*?---\s*/g, '') // 구분선 제거
                    .replace(/^\s*📝\s*AI\s*단어장\s*\n*/i, '') // 제목 제거
                    .trim();
                
                // 단어장 결과를 프론트엔드에 반환
                res.json({
                    success: true,
                    vocabulary: vocabText
                });
            } else {
                throw new Error('Gemini API 응답 형식이 올바르지 않습니다.');
            }
        } else {
            throw new Error('단어장을 받을 수 없습니다.');
        }

    } catch (error) {
        console.error('Gemini 단어장 생성 오류:', error);

        // 에러 응답 처리
        if (error.response) {
            const errorMessage = error.response.data?.error?.message || error.message;
            const statusCode = error.response.status || 500;
            
            // 403 Forbidden 오류 처리 (API 키 유출)
            if (statusCode === 403) {
                return res.status(403).json({
                    success: false,
                    error: 'API 키 유출',
                    message: 'Gemini API 키가 유출되어 차단되었습니다. 새로운 API 키를 발급받아 .env 파일에 설정해주세요.',
                    helpUrl: 'https://aistudio.google.com/apikey'
                });
            }
            
            res.status(statusCode).json({
                success: false,
                error: 'Gemini API 오류',
                message: errorMessage,
                statusCode: statusCode
            });
        } else if (error.request) {
            res.status(503).json({
                success: false,
                error: '서비스 연결 오류',
                message: 'Gemini API에 연결할 수 없습니다.'
            });
        } else {
            res.status(500).json({
                success: false,
                error: '서버 오류',
                message: error.message || '알 수 없는 오류가 발생했습니다.'
            });
        }
    }
});

// POST /api/ai/lookup 엔드포인트
app.post('/api/ai/lookup', async (req, res) => {
    // 1. 요청 받기: 프론트엔드에서 클릭된 단어를 추출
    const { word } = req.body;
    
    if (!word) {
        return res.status(400).json({ success: false, message: "단어를 제공해주세요." });
    }

    // Gemini API 키 확인
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('발급받은')) {
        return res.status(500).json({
            success: false,
            message: "Gemini API 키가 설정되지 않았습니다."
        });
    }

    // 2. AI 요청을 위한 프롬프트 구성
    const prompt = `
        다음 영어 단어의 한국어 뜻, 해당 단어를 포함한 영어 예문 하나, 그리고 발음 정보를 JSON 형식으로만 응답해 줘. 
        어떤 설명도 추가하지 말고 반드시 JSON 객체 하나만 응답해야 해.
        JSON 형식은 { "success": true, "word": "단어", "meaning": "뜻", "example": "예문", "pronunciation": "발음" } 이야.
        단어: ${word}
    `;

    try {
        // 3. Gemini API 호출
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json", // JSON 형식 응답 요청
            },
        });

        // 4. AI 응답 처리 및 전송
        const jsonText = response.text;
        const aiData = JSON.parse(jsonText);

        res.json(aiData); // 프론트엔드로 AI 결과 전송
        
    } catch (error) {
        console.error("Gemini API 호출 오류:", error);
        
        // 에러 응답 처리
        if (error.response) {
            // Gemini API에서 반환한 에러
            const errorMessage = error.response.data?.error?.message || error.message;
            const statusCode = error.response.status || 500;
            console.error('Gemini API 에러 응답:', error.response.data);
            
            res.status(statusCode).json({
                success: false,
                error: 'Gemini API 오류',
                message: errorMessage,
                statusCode: statusCode
            });
        } else if (error.request) {
            // 요청은 보냈지만 응답을 받지 못함
            res.status(503).json({
                success: false,
                error: '서비스 연결 오류',
                message: 'Gemini API에 연결할 수 없습니다.'
            });
        } else {
            // 요청 설정 중 오류 발생
            res.status(500).json({
                success: false,
                error: '서버 오류',
                message: error.message || '알 수 없는 오류가 발생했습니다.'
            });
        }
    }
});

// 정적 파일 서빙 (모든 API 엔드포인트 이후, 404 핸들러 이전)
// HTML, CSS, JS 파일 등을 서버를 통해 제공
app.use(express.static('.'));

// 404 핸들러
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: '요청한 엔드포인트를 찾을 수 없습니다.'
    });
});

// 서버 시작 전 Spotify Access Token 미리 발급
(async () => {
    if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET) {
        console.log('🎵 Spotify Access Token 사전 발급 중...');
        const token = await getSpotifyAccessToken();
        if (token) {
            console.log('✅ Spotify Access Token 사전 발급 완료');
        } else {
            console.log('⚠️ Spotify Access Token 사전 발급 실패 (서버 시작 후 자동 재시도됨)');
        }
    }
})();

// ============================================
// Socket.io 실시간 채팅 처리
// ============================================

io.on('connection', (socket) => {
    console.log('✅ 사용자 연결:', socket.id);

    // 방 입장
    socket.on('join-room', (roomId, username) => {
        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.username = username;
        
        // 방의 참여자 수 업데이트
        const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;
        io.to(roomId).emit('user-joined', {
            username,
            roomSize,
            message: `${username}님이 참여했습니다.`
        });
        
        console.log(`${username}님이 ${roomId} 방에 입장했습니다.`);
    });

    // 메시지 수신 및 브로드캐스트
    socket.on('chat-message', (data) => {
        const { roomId, message, username, timestamp } = data;
        
        // 같은 방의 모든 사용자에게 메시지 전송
        io.to(roomId).emit('new-message', {
            username,
            message,
            timestamp,
            socketId: socket.id
        });
        
        console.log(`[${roomId}] ${username}: ${message}`);
    });

    // 연결 해제
    socket.on('disconnect', () => {
        if (socket.data.roomId && socket.data.username) {
            const roomSize = io.sockets.adapter.rooms.get(socket.data.roomId)?.size || 0;
            io.to(socket.data.roomId).emit('user-left', {
                username: socket.data.username,
                roomSize,
                message: `${socket.data.username}님이 나갔습니다.`
            });
        }
        console.log('❌ 사용자 연결 해제:', socket.id);
    });
});

// 서버 시작
server.listen(PORT, () => {
    console.log(`🚀 LitConnect 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`📝 DeepL API 키 설정: ${DEEPL_API_KEY ? (DEEPL_API_KEY.includes('발급받은') ? '❌ 미설정' : '✅ 설정됨') : '❌ 미설정'}`);
    console.log(`🤖 Gemini API 키 설정: ${GEMINI_API_KEY ? (GEMINI_API_KEY.includes('발급받은') ? '❌ 미설정' : '✅ 설정됨') : '❌ 미설정'}`);
    console.log(`🎵 Spotify API 키 설정: ${SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET ? '✅ 설정됨' : '❌ 미설정'}`);
    console.log(`🗄️  MongoDB 연결: ${MONGO_URI ? '✅ 설정됨' : '❌ 미설정'}`);
    console.log(`🌐 서버 주소: http://localhost:${PORT}`);
    console.log(`📚 API 가이드: http://localhost:${PORT}/`);
    console.log(`📖 책 챕터 API: http://localhost:${PORT}/api/book/chapter/:bookTitle/:chapterNumber`);
    console.log(`💬 Socket.io 실시간 채팅: 활성화됨`);
});

