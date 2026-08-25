import { beausActivitySnapshot } from '../data/beausActivity';

type BeausActivityWorkspaceProps = {
  readonly onReturnToDocument: () => void;
  readonly onSelectDocument: (slug: string, sectionId?: string | null) => void;
};

export function BeausActivityWorkspace({ onReturnToDocument, onSelectDocument }: BeausActivityWorkspaceProps) {
  return (
    <section aria-labelledby="beaus-activity-title" className="wikiWorkspace companyActivityWorkspace">
      <header className="wikiWorkspaceHeader">
        <div>
          <span className="workspaceEyebrow">Company activity intelligence</span>
          <h1 id="beaus-activity-title">뷰스컴퍼니 기업 활동</h1>
          <p className="companyActivityLead">공개 SNS·브랜드 채널을 면접 관점으로 압축한 스냅샷 · {beausActivitySnapshot.capturedAt}</p>
        </div>
        <button className="workspaceBack" onClick={onReturnToDocument} type="button">문서로 돌아가기</button>
      </header>

      <section className="companyActivitySection" aria-labelledby="company-themes-title">
        <div className="companySectionHeading">
          <span>What they are pushing</span>
          <h2 id="company-themes-title">지금 반복해서 보이는 사업 키워드</h2>
        </div>
        <div className="companyThemeGrid">
          {beausActivitySnapshot.themes.map(([name, description]) => (
            <article className="companyThemeCard" key={name}>
              <strong>{name}</strong>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="companyActivitySection" aria-labelledby="company-signals-title">
        <div className="companySectionHeading">
          <span>Public signals</span>
          <h2 id="company-signals-title">공개 활동 → 사업 해석 → 면접 연결</h2>
        </div>
        <div className="companySignalList">
          {beausActivitySnapshot.signals.map((signal) => (
            <article className="companySignalCard" key={`${signal.source}-${signal.title}`}>
              <div className="companySignalMeta"><span>{signal.source}</span><span>{signal.dateLabel}</span></div>
              <h3>{signal.title}</h3>
              <p>{signal.summary}</p>
              <dl>
                <div><dt>사업 시그널</dt><dd>{signal.businessSignal}</dd></div>
                <div><dt>면접 연결</dt><dd>{signal.interviewAngle}</dd></div>
              </dl>
              <a href={signal.url} rel="noreferrer" target="_blank">공개 출처 열기 ↗</a>
            </article>
          ))}
        </div>
      </section>

      <section className="companyActivitySection" aria-labelledby="company-channels-title">
        <div className="companySectionHeading">
          <span>Source coverage</span>
          <h2 id="company-channels-title">채널 수집 상태</h2>
        </div>
        <ul className="companyChannelList">
          {beausActivitySnapshot.channels.map((channel) => (
            <li key={channel.label}>
              <a href={channel.url} rel="noreferrer" target="_blank">{channel.label}</a>
              <span>{channel.note}</span>
            </li>
          ))}
        </ul>
        <p className="companyCrawlNote">Facebook/Instagram은 로그인·Graph API 정책을 우회해서 긁지 않는다. 공개 링크와 확인 가능한 메타데이터를 기준으로 보고, 실제 운영 자동화라면 공식 API·권한 기반 수집을 우선한다.</p>
      </section>

      <section className="companyActivityCallout" aria-labelledby="company-answer-title">
        <span>면접에서 한 문장으로</span>
        <h2 id="company-answer-title">“뷰스는 콘텐츠 회사이면서 운영 데이터가 계속 생기는 회사라 자동화의 효과를 바로 측정하기 좋다고 봤습니다.”</h2>
        <p>유튜브 쇼핑·숏폼·크리에이터 운영처럼 연결점이 많아질수록 수집, 정리, 승인, 리포트의 자동화 가치가 커진다는 흐름으로 답하면 된다.</p>
        <button onClick={() => onSelectDocument('BEAUS-LLM-AUTOMATION-INTERVIEW-PREP')} type="button">뷰스 면접 문서로 이동</button>
      </section>
    </section>
  );
}
