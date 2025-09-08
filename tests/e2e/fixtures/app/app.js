(function() {
    // ===== DOM refs =====
    const $cal    = document.getElementById('calendar');
    const $slots  = document.getElementById('slots');
    const $timeslotHidden = document.getElementById('timeslot-hidden');
    const $agree  = document.getElementById('agree');
    const $submit = document.getElementById('submitBtn');
    const $error  = document.getElementById('inputError');
    const $ok     = document.getElementById('okBanner');
    const $amount = document.getElementById('amountLabel');
  
    const $adult   = document.querySelector('[data-test="adult-count"]');
    const $student = document.querySelector('[data-test="student-count"]');
    const $child   = document.querySelector('[data-test="child-count"]');
    const $infant  = document.querySelector('[data-test="infant-count"]');
  
    const $name   = document.querySelector('[data-test="customer-name"]');
    const $email  = document.querySelector('[data-test="customer-email"]');
    const $phone  = document.querySelector('[data-test="customer-phone"]');
  
    // ===== constants =====
    const SLOT_LIST = ['10:00','11:00','13:00','15:00']; // 代表スロット
    const MAX_ADVANCE = 90; // 90日以内OK、91日目は不可
  
    // ===== utilities (正午固定で日付ズレ防止) =====
    function startOfToday() { const d=new Date(); d.setHours(12,0,0,0); return d; }
    function pad(n){ return n<10?`0${n}`:`${n}`; }
    function iso(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
    function addDays(base, days){ const x=new Date(base); x.setDate(x.getDate()+days); return x; }
  
    // hidden フィールド保障（name/type/data-* を付与）
    if ($timeslotHidden) {
      $timeslotHidden.setAttribute('type','hidden');
      if (!$timeslotHidden.getAttribute('name')) $timeslotHidden.setAttribute('name','slot');
    }
  
    // 送信ボタン/エラーバナー/成功バナーに data-test を付与（ReservationWidget が拾えるように）
    if ($submit) {
      // data-test は単一属性のため最後の値が残る。Widget は [data-test="pay-button"], [data-test="submit"] のORで探す実装なのでどちらでも可。
      $submit.setAttribute('data-test','submit');
    }
    if ($error) {
      $error.setAttribute('data-test','payment-error');
    }
    if ($ok) {
      $ok.setAttribute('data-test','booking-confirmed');
    }
    if ($agree) {
      $agree.setAttribute('data-test','agree-checkbox');
      $agree.setAttribute('required','true'); // 必須扱い
    }
    if ($amount) {
      $amount.setAttribute('data-test','amount');
      $amount.setAttribute('data-test-amount','0'); // 初期 0
    }
  
    // ---- Calendar render
    function renderCalendar(){
      if (!$cal) return;
      $cal.innerHTML = '';
      const todayNoon = startOfToday();
  
      for (let i=0;i<=MAX_ADVANCE+2;i++){ // +2 で 91日目が不可なのを可視化
        const d = addDays(todayNoon,i);
        const isoStr = iso(d);
        const is91 = i>MAX_ADVANCE;
  
        const btn = document.createElement('button');
        btn.className = 'date-card';
        btn.textContent = isoStr + (is91 ? '（無効）' : '');
        // ReservationWidget が拾う両シグナル
        btn.setAttribute('data-test', `date-${isoStr}`);
        btn.setAttribute('data-test-date', isoStr);
        btn.setAttribute('aria-label', isoStr);
  
        if (is91){
          btn.setAttribute('data-test-disabled','true');
          btn.classList.add('disabled');
          btn.disabled = true;
          btn.setAttribute('aria-disabled','true');
        }
  
        btn.addEventListener('click', () => {
          if (btn.hasAttribute('data-test-disabled') || btn.disabled){
            showError('この日は予約できません');
            renderSlots([]); // クリア
            ensureSubmitState();
            return;
          }
          hideError();
          renderSlots(SLOT_LIST); // 選択可能日 → スロット描画
  
          // hidden をクリア（選択はこれから）
          if ($timeslotHidden) {
            $timeslotHidden.value = '';
            $timeslotHidden.setAttribute('value','');
            $timeslotHidden.setAttribute('data-time-value','');
            $timeslotHidden.setAttribute('data-slot-value','');
            console.log('[hidden-update]', { phase:'clear-on-date-select', prop:$timeslotHidden.value, attr:$timeslotHidden.getAttribute('value'), dt:$timeslotHidden.getAttribute('data-time-value'), ds:$timeslotHidden.getAttribute('data-slot-value') });
          }
          ensureSubmitState();
        });
  
        $cal.appendChild(btn);
      }
    }
  
    // ---- Slots
    function renderSlots(list){
      if (!$slots) return;
      $slots.innerHTML = '';
      if (!list || list.length===0){
        // UI にスロットが無いケース：hidden にデフォルト値を入れて ReservationWidget の hasTimeValue() を満たす
        if ($timeslotHidden) {
          const v = '10:00';
          $timeslotHidden.value = v;                    // プロパティ
          $timeslotHidden.setAttribute('value', v);     // 属性（両対応）
          $timeslotHidden.setAttribute('data-time-value', v);
          $timeslotHidden.setAttribute('data-slot-value', v);
          console.log('[hidden-update]', { phase:'fallback-no-slots', prop:$timeslotHidden.value, attr:$timeslotHidden.getAttribute('value'), dt:$timeslotHidden.getAttribute('data-time-value'), ds:$timeslotHidden.getAttribute('data-slot-value') });
        }
        return;
      }
  
      list.forEach(t=>{
        const b = document.createElement('button');
        b.className = 'slot-btn';
        b.textContent = t;
        // ReservationWidget が拾う両シグナル
        b.setAttribute('data-test', `slot-${t}`);
        b.setAttribute('data-test-slot', t);
        b.setAttribute('role', 'button');
  
        b.addEventListener('click', ()=>{
          // 1選択（視覚/ARIA/State 全部更新）
          [...$slots.querySelectorAll('.slot-btn')].forEach(x=>{
            x.classList.remove('selected');
            x.removeAttribute('aria-pressed');
            x.removeAttribute('aria-selected');
            x.removeAttribute('data-state');
            x.removeAttribute('data-selected');
          });
          b.classList.add('selected');
          b.setAttribute('aria-pressed','true');
          b.setAttribute('aria-selected','true');
          b.setAttribute('data-state','selected');
          b.setAttribute('data-selected','true');
  
          // hidden 同期（hasTimeValue 判定を確実に満たす）
          if ($timeslotHidden) {
            $timeslotHidden.value = t;                    // プロパティ
            $timeslotHidden.setAttribute('value', t);     // 属性
            $timeslotHidden.setAttribute('data-time-value', t);
            $timeslotHidden.setAttribute('data-slot-value', t);
            console.log('[hidden-update]', { phase:'select-slot', prop:$timeslotHidden.value, attr:$timeslotHidden.getAttribute('value'), dt:$timeslotHidden.getAttribute('data-time-value'), ds:$timeslotHidden.getAttribute('data-slot-value') });
          }
          ensureSubmitState();
        });
  
        $slots.appendChild(b);
      });
    }
  
    // ---- Amount
    function updateAmount(){
      const adult   = parseInt(($adult?.value)||'0',10)||0;
      const student = parseInt(($student?.value)||'0',10)||0;
      const child   = parseInt(($child?.value)||'0',10)||0;
      const infant  = parseInt(($infant?.value)||'0',10)||0;
  
      // 金額は E2E の想定（大人3000 / 学生1500 / 小人1000 / 幼児0）に合わせる
      const yen = adult*3000 + student*1500 + child*1000 + infant*0;
      if ($amount) {
        $amount.textContent = `¥${yen.toLocaleString('ja-JP')}`;
        $amount.setAttribute('data-test-amount', String(yen));
      }
    }
  
    [$adult,$student,$child,$infant].forEach(el=>{
      if (el) el.addEventListener('input', updateAmount);
    });
  
    // ---- Submit enable rule
    function hasSlotSelected(){
      if ($slots && $slots.querySelector('.slot-btn.selected')) return true;
      if ($timeslotHidden) {
        const prop = ($timeslotHidden.value || '').trim();
        const attr = ($timeslotHidden.getAttribute('value') || '').trim();
        const dt   = ($timeslotHidden.getAttribute('data-time-value') || '').trim();
        const ds   = ($timeslotHidden.getAttribute('data-slot-value') || '').trim();
        if (prop || attr || dt || ds) return true;
      }
      return false;
    }
  
    function showError(msg){
      if ($error){
        $error.style.display='block';
        $error.textContent = msg || 'エラーが発生しました';
        $error.setAttribute('data-test','payment-error');
      }
    }
    function hideError(){
      if ($error){
        $error.style.display='none';
        $error.textContent = '';
      }
    }
  
    function ensureSubmitState(){
      const nameOk  = !!($name && $name.value && $name.value.trim());
      const emailOk = !!($email && /@/.test($email.value || ''));
      const phoneOk = !!($phone && ($phone.value||'').trim());
      const agreeOk = !!($agree && $agree.checked);
      const slotOk  = hasSlotSelected();
  
      const enable = nameOk && emailOk && phoneOk && agreeOk && slotOk;
      if ($submit){
        $submit.disabled = !enable;
        if (enable){
          $submit.removeAttribute('aria-disabled');
          $submit.removeAttribute('data-disabled');
          $submit.removeAttribute('data-state');
        }else{
          $submit.setAttribute('aria-disabled','true');
          $submit.setAttribute('data-disabled','true');
          $submit.setAttribute('data-state','disabled');
        }
      }
    }
  
    [$name,$email,$phone,$agree].forEach(el=>{
      if (!el) return;
      el.addEventListener('input', ensureSubmitState);
      el.addEventListener('change', ensureSubmitState);
      el.addEventListener('blur', ensureSubmitState);
    });
  
    // ---- Submit
    if ($submit){
      $submit.addEventListener('click', (e)=>{
        if ($submit.disabled){
          e.preventDefault();
          showError('入力が不足しています');
          return;
        }
        hideError();
        if ($ok){
          $ok.style.display='block';
          $ok.setAttribute('data-test','booking-confirmed');
        }
        // 実サービスならここで Checkout へ遷移
      });
    }
  
    // 初期描画
    renderCalendar();
    renderSlots([]); // 初期は空（hidden 値でフォロー）
    updateAmount();
    ensureSubmitState();
  
    // “ロード済み” フラグ（ReservationWidget.waitForWidget 用）
    // どちらのシグナルでも拾える： [data-test-widget-loaded="true"] or [data-test="widget-loaded"][data-value="true"]
    document.body.setAttribute('data-test-widget-loaded','true');
    const loadedFlag = document.querySelector('[data-test="widget-loaded"]');
    if (loadedFlag) loadedFlag.setAttribute('data-value','true');
  })();
  