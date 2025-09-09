// 最低限のアクセシビリティ: "/" で検索ボックスへフォーカス
document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
      const el = document.getElementById('site-search');
      if (el) {
        e.preventDefault();
        el.focus();
      }
    }
  });
  