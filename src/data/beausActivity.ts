export type BeausActivitySignal = {
  source: string;
  dateLabel: string;
  title: string;
  summary: string;
  businessSignal: string;
  interviewAngle: string;
  url: string;
};

export const beausActivitySnapshot = {
  capturedAt: '2026-08-25',
  channels: [
    { label: 'Beaus Facebook', url: 'https://www.facebook.com/beauscompany/', note: '공식 페이지 링크 확인. 게시물 자동 수집은 Meta 로그인/정책 제약 때문에 링크 모니터링만 사용.' },
    { label: 'Beaus Instagram', url: 'https://www.instagram.com/beaus_company/', note: '회사 공식 채널.' },
    { label: 'BROUND', url: 'https://bround.oopy.io/', note: '뷰스컴퍼니 MCN 브랜드. YouTube·TikTok 등 채널 연결과 브랜드/크리에이터 성과 공개.' },
    { label: 'CEO LinkedIn', url: 'https://kr.linkedin.com/in/jinhorus', note: '사업 방향·유튜브 쇼핑·숏폼 커머스 실험을 읽기 좋은 공개 채널.' },
  ],
  signals: [
    {
      source: 'CEO LinkedIn',
      dateLabel: '최근 공개 활동',
      title: '유튜브 쇼핑·어필리에이트 모델 테스트',
      summary: '숏폼 커머스와 제휴마케팅을 테스트하고, 유튜브·올리브영·지그재그·무신사 등과 연결되는 쇼핑 모델을 확장하려는 방향이 공개돼 있다.',
      businessSignal: '광고 집행보다 크리에이터의 관심 시간을 커머스 전환까지 연결하는 구조를 만들려는 단계.',
      interviewAngle: '콘텐츠 성과·상품·크리에이터·채널 데이터가 연결되므로 반복 집계와 운영 자동화의 ROI가 커질 수 있다고 연결.',
      url: 'https://kr.linkedin.com/in/jinhorus',
    },
    {
      source: 'BROUND',
      dateLabel: '공개 브랜드 페이지',
      title: '마이크로 크리에이터 육성 + 숏폼 중심',
      summary: '비라운드는 브랜드 컨설팅 경험을 기반으로 크리에이터를 발굴·육성하고 쇼츠·릴스 같은 숏폼 콘텐츠 제작과 브랜드 성과를 전면에 둔다.',
      businessSignal: 'MCN을 단순 매니지먼트가 아니라 반복 가능한 콘텐츠 생산·성장 시스템으로 보고 있다.',
      interviewAngle: '크리에이터 운영 상태, 콘텐츠 제작 이력, 캠페인 성과를 한 흐름으로 자동화하는 내부 도구 아이디어와 연결.',
      url: 'https://bround.oopy.io/',
    },
    {
      source: 'BROUND YouTube evidence',
      dateLabel: '공식 사이트 연결 영상',
      title: 'YouTube를 브랜드/크리에이터 성과 채널로 직접 활용',
      summary: '비라운드 공식 페이지가 YouTube 영상을 직접 연결하고 YouTube·TikTok을 주요 접점으로 노출한다.',
      businessSignal: '영상 플랫폼 자체가 마케팅 채널이면서 크리에이터 포트폴리오·커머스 퍼널의 일부다.',
      interviewAngle: 'YouTube API/RSS 기반 콘텐츠·성과 수집 → 정규화 → 리포트 초안 자동화 같은 실전 과제로 설명 가능.',
      url: 'https://youtu.be/yT1zh1XX7Fc',
    },
    {
      source: 'Beaus company profile',
      dateLabel: '공개 회사 이력',
      title: '페이스북 마케팅에서 시작한 소셜·뷰티 데이터 회사',
      summary: '뷰스컴퍼니는 초기부터 페이스북·유튜브·인플루언서·뷰티 트렌드를 묶어 캠페인을 운영해 온 것으로 소개된다.',
      businessSignal: 'SNS는 홍보 채널 하나가 아니라 회사의 오래된 핵심 운영 데이터 원천에 가깝다.',
      interviewAngle: 'SNS 데이터 수집 자체보다 출처, 중복, 수집 시각, API 제한, 실패 복구까지 포함해 자동화를 설계하겠다고 말하기 좋다.',
      url: 'https://www.i-boss.co.kr/ab-6043-842',
    },
  ] satisfies BeausActivitySignal[],
  themes: [
    ['숏폼', '쇼츠·릴스 중심의 콘텐츠 생산과 크리에이터 성장'],
    ['커머스', '유튜브 쇼핑·어필리에이트·플랫폼 연동'],
    ['크리에이터', '마이크로 크리에이터 발굴·육성·성과 관리'],
    ['데이터', '뷰티 트렌드와 채널 성과를 사업 의사결정에 사용'],
  ] as const,
};
