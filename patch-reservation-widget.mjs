import fs from 'fs';

const file = 'tests/e2e/fixtures/ReservationWidget.ts';
let src = fs.readFileSync(file, 'utf8');

// ========== 追加ヘルパー（tagAndType）を hasDisabledClass() の直後に追記 ==========
const helperInsertAfter = /private\s+async\s+hasDisabledClass\s*\([\s\S]*?\)\s*:\s*Promise<boolean>\s*\{[\s\S]*?\n\s*\}\n/;
const helperCode = `
  /** 要素の tagName と type を取得（radio/checkbox 分岐用） */
  private async tagAndType(el: Locator): Promise<{ tag: string; type: string }> {
    try {
      const tag = (await el.evaluate((n: any) => n.tagName?.toLowerCase())) || '';
      const type = ((await el.getAttribute('type')) || '').toLowerCase();
      return { tag, type };
    } catch {
      return { tag: '', type: '' };
    }
  }
`.trim();

if (!src.includes('tagAndType(el: Locator)')) {
  const m = src.match(helperInsertAfter);
  if (!m) {
    console.error('❌ hasDisabledClass() の位置が見つかりませんでした。ファイル構造が想定外です。');
    process.exit(1);
  }
  src = src.replace(helperInsertAfter, m[0] + '\n' + helperCode + '\n');
}

// ========== isTimeSelected() を置換（data-selected も検知） ==========
const isTimeSelectedStart =
  /private\s+async\s+isTimeSelected\s*\(\)\s*:\s*Promise<boolean>\s*\{/;
const isTimeSelectedBlock = `
  /** 時間帯が選択済みかをざっくり判定 */
  private async isTimeSelected(): Promise<boolean> {
    if (!(await this.exists(this.s.timeGroup))) return false;
    const g = this.s.timeGroup;
    const selected = g.locator([
      '[aria-pressed="true"]',
      '[aria-checked="true"]',
      '[data-state="on"]',
      '[data-state="selected"]',
      '[data-selected="true"]',
      '.is-active',
      '.active',
      '.selected',
      '[aria-current="true"]',
      'input[type="radio"]:checked',
      'input[type="checkbox"]:checked',
    ].join(', '));
    return (await selected.count().catch(() => 0)) > 0;
  }
`.trim();

{
  const re = new RegExp(isTimeSelectedStart.source + '[\\s\\S]*?\\n\\s*}\\n');
  const before = src;
  src = src.replace(re, isTimeSelectedBlock + '\n');
  if (src === before) {
    console.error('❌ isTimeSelected() の置換に失敗しました。関数宣言が見つかりません。');
    process.exit(1);
  }
}

// ========== selectFirstAvailableTimeSlot() を置換（radio/checkbox は check() 優先＋label フォールバック） ==========
const selectFirstStart =
  /private\s+async\s+selectFirstAvailableTimeSlot\s*\(\)\s*:\s*Promise<boolean>\s*\{/;
const selectFirstBlock = `
  /** 最初の有効な時間帯を自動選択（成功したら true） */
  private async selectFirstAvailableTimeSlot(): Promise<boolean> {
    if (!(await this.exists(this.s.timeGroup))) return false;
    await this.waitVisible(this.s.timeGroup, 8000);
    const candidates = this.s.timeGroup.locator([
      '[data-test^="slot-"]',
      '[data-test-slot]',
      'button',
      '[role="button"]',
      'input[type="radio"]',
      'input[type="checkbox"]',
    ].join(', '));

    const n = await candidates.count().catch(() => 0);
    for (let i = 0; i < n; i++) {
      const c = candidates.nth(i);
      const dataState = (await c.getAttribute('data-state')) || '';
      const disabled =
        (await c.getAttribute('disabled')) != null ||
        (await c.getAttribute('aria-disabled')) === 'true' ||
        (await c.getAttribute('data-disabled')) === 'true' ||
        dataState === 'disabled' ||
        (await this.hasDisabledClass(c));

      if (disabled) continue;

      const { tag, type } = await this.tagAndType(c);
      try {
        if (tag === 'input' && (type === 'radio' || type === 'checkbox')) {
          await c.check({ trial: true }).catch(() => {});
          await c.check().catch(async () => {
            const id = (await c.getAttribute('id')) || '';
            if (id) {
              const lb = this.page.locator(\`label[for="\${id}"]\`);
              if (await lb.count()) await this.clickWithRetry(lb.first());
            } else {
              const wrap = c.locator('xpath=ancestor::label[1]');
              if (await wrap.count()) await this.clickWithRetry(wrap.first());
            }
          });
        } else {
          await this.clickWithRetry(c);
        }

        for (let t = 0; t < 8; t++) {
          if (await this.isTimeSelected()) return true;
          await this.page.waitForTimeout(75);
        }
      } catch {}
    }
    return await this.isTimeSelected();
  }
`.trim();

{
  const re = new RegExp(selectFirstStart.source + '[\\s\\S]*?\\n\\s*}\\n');
  const before = src;
  src = src.replace(re, selectFirstBlock + '\n');
  if (src === before) {
    console.error('❌ selectFirstAvailableTimeSlot() の置換に失敗しました。関数宣言が見つかりません。');
    process.exit(1);
  }
}

// ========== dumpTimeSlots() を置換（data-selected をダンプ） ==========
const dumpSlotsStart =
  /private\s+async\s+dumpTimeSlots\s*\(\s*prefix\s*=\s*'TimeSlots'\s*\)\s*:\s*Promise<void>\s*\{/;
const dumpSlotsBlock = `
  /** 時間帯スロットの状態をダンプ */
  private async dumpTimeSlots(prefix = 'TimeSlots'): Promise<void> {
    if (!(await this.exists(this.s.timeGroup))) {
      console.log(\`[\${prefix}] time group not present\`);
      return;
    }
    const items = this.s.timeGroup.locator(
      'button, [role="button"], [data-test-slot], [data-test^="slot-"], input[type="radio"], input[type="checkbox"]'
    );
    const n = await items.count().catch(() => 0);
    const lines: string[] = [];
    for (let i = 0; i < n; i++) {
      const it = items.nth(i);
      const txt = (await it.innerText().catch(() => '')).trim();
      const value = (await it.getAttribute('value')) || '';
      const ariaPressed = await it.getAttribute('aria-pressed') || '';
      const ariaChecked = await it.getAttribute('aria-checked') || '';
      const dataState = await it.getAttribute('data-state') || '';
      const dataSelected = await it.getAttribute('data-selected') || '';
      const disabled =
        (await it.getAttribute('disabled')) != null ||
        (await it.getAttribute('aria-disabled')) === 'true' ||
        (await it.getAttribute('data-disabled')) === 'true' ||
        dataState === 'disabled' ||
        (await this.hasDisabledClass(it));
      lines.push(
        \`• slot[\${i}]: "\${txt || value || '(no label)'}" => \${disabled ? 'DISABLED' : 'ENABLED'} (pressed=\${ariaPressed} checked=\${ariaChecked} state=\${dataState} data-selected=\${dataSelected})\`
      );
    }
    console.log(\`[\${prefix}] items (\${n})\`);
    for (const l of lines) console.log(l);
  }
`.trim();

{
  const re = new RegExp(dumpSlotsStart.source + '[\\s\\S]*?\\n\\s*}\\n');
  const before = src;
  src = src.replace(re, dumpSlotsBlock + '\n');
  if (src === before) {
    console.error('❌ dumpTimeSlots() の置換に失敗しました。関数宣言が見つかりません。');
    process.exit(1);
  }
}

fs.writeFileSync(file, src, 'utf8');
console.log('✅ ReservationWidget.ts にパッチを適用しました。');
