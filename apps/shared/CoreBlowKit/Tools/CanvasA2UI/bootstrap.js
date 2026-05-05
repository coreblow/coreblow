// CoreBlow Canvas A2UI bootstrap script
(function() {
  window.__coreblow_a2ui = { version: 1, actions: [] };
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'a2ui') { window.__coreblow_a2ui.actions.push(e.data); }
  });
})();
