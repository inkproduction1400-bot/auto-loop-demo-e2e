// 価格（testsの想定に合わせる）
const PRICE = { adult: 3000, student: 1500, child: 1000, infant: 0 };

const qs = (s) => document.querySelector(s);
const qsa = (s) => Array.from(document.querySelectorAll(s));

const state = {
  date: null,
  slot: null,
  counts: { adult: 0, student: 0, child: 0, infant: 0 },
};

function fmtJPY(n) {
  return '¥' + n.toLocaleString('ja-JP');
}

function calcAmount() {
  const total =
    state.counts.adult * PRICE.adult +
    state.counts.student * PRICE.student +
    state.counts.child * PRICE.child +
    state.counts.infant * PRICE.infant;

  const el = qs('#amount');
  el.dataset.testAmount = String(total);
  el.setAttribute('data-test-amount', String(total)); // Playwright の attr 取得用
  el.textContent = fmtJPY(total);
}

function setCountsFromInputs() {
  state.counts.adult = Number(qs('[data-test-adult-count]').value || 0);
  state.counts.student = Number(qs('[data-test-student-count]').value || 0);
  state.counts.child = Number(qs('[data-test-child-count]').value || 0);
  state.counts.infant = Number(qs('[data-test-infant-count]').value || 0);
  calcAmount();
}

function init() {
  // 日付ピッカーを開く
  qs('#openDates').addEventListener('click', () => {
    qs('#dateGrid').classList.toggle('hidden');
  });

  // 日付ボタン
  qsa('#dateGrid button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const disabled =
        btn.getAttribute('data-test-date-disabled') === 'true';
      if (disabled) return;
      state.date = btn.getAttribute('data-test-date') || btn.dataset.testDate;
      // 視認性のため閉じる
      qs('#dateGrid').classList.add('hidden');
    });
  });

  // スロット
  qsa('[data-test-slot]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.slot = btn.getAttribute('data-test-slot') || btn.dataset.testSlot;
    });
  });

  // 人数入力
  ['adult', 'student', 'child', 'infant'].forEach((k) => {
    qs(`[data-test-${k}-count]`).addEventListener('input', setCountsFromInputs);
  });
  calcAmount();

  // 決済
  qs('[data-test-pay-button]').addEventListener('click', () => {
    qs('#complete').classList.add('hidden');
    qs('#payErr').classList.add('hidden');

    const card = qs('[data-test-card-number]').value.trim();
    if (card === '4000000000000002') {
      // decline
      qs('#payErr').classList.remove('hidden');
      return;
    }
    // 成功
    qs('#complete').classList.remove('hidden');
  });
}

document.addEventListener('DOMContentLoaded', init);
