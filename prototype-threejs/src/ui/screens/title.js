// 타이틀: 새로 시작 / 이어하기 / 개발용 메뉴(일반 플레이와 분리)
import { h, button } from '../dom.js';
import { TitleView } from '../../render/views/titleView.js';

export function mountTitle(app) {
  app.stage.setView(new TitleView());
  const save = app.loadSave();
  app.ui.append(
    h('div', { class: 'title-box' },
      h('h1', { text: 'KATANA-UCHI' }),
      h('div', { class: 'sub', text: '刀打ち · v0.1 플레이 시안 (three.js)' }),
      button('새로 시작하기', () => app.newGame(), { cls: 'primary', testid: 'new-game' }),
      save ? button(`이어하기 (${save.state.day}일차)`, () => app.continueGame(), { testid: 'continue' }) : null,
      button('개발용 메뉴', () => app.go('dev'), { testid: 'dev-menu' }),
    ),
    h('div', { class: 'panel title-help' },
      h('h2', { text: '이렇게 플레이합니다' }),
      h('ol', { style: { margin: '0', paddingLeft: '20px' } },
        h('li', { text: '지도에서 연결된 장소 하나를 골라 출발합니다.' }),
        h('li', { text: '길 위에서는 하루마다 사건을 해결하고 진행·노숙·되돌아가기를 고릅니다.' }),
        h('li', { text: '강변에서 사철, 산에서 철광석, 숲에서 숯을 구합니다.' }),
        h('li', { text: '마을 공방으로 돌아와 강재 두 개를 단련하고, 성형하고, 담금질합니다.' }),
        h('li', { text: '결과의 원인을 보고 다시 만들어 봅니다.' }),
      ),
      h('p', { class: 'muted small', text: '마우스로 모든 조작을 할 수 있습니다. F2: 개발용 실제 수치 표시.' }),
    ),
  );
}
