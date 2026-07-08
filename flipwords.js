/* Drop — flip-words: cycles the word inside [data-flip] in place.
   Reserves the widest word's width so surrounding copy never reflows.
   Reduced-motion → renders the first word statically, no cycling. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nodes = document.querySelectorAll('[data-flip]');
  for (var i = 0; i < nodes.length; i++) init(nodes[i]);

  function init(node) {
    var words = (node.getAttribute('data-flip') || '').split(',')
      .map(function (w) { return w.trim(); })
      .filter(Boolean);
    if (words.length < 2) return;

    // Reserve the widest word's width so "near you" doesn't jump on each flip.
    var probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:inherit;';
    node.appendChild(probe);
    var max = 0;
    for (var j = 0; j < words.length; j++) {
      probe.textContent = words[j];
      if (probe.offsetWidth > max) max = probe.offsetWidth;
    }
    node.removeChild(probe);

    node.style.display = 'inline-block';
    node.style.minWidth = max + 'px';
    node.style.textAlign = 'center';
    node.textContent = words[0];
    if (reduce) return;

    var idx = 0;
    node.style.transition = 'opacity .3s var(--ease, ease)';
    setInterval(function () {
      node.style.opacity = '0';
      setTimeout(function () {
        idx = (idx + 1) % words.length;
        node.textContent = words[idx];
        node.style.opacity = '1';
      }, 300);
    }, 2600);
  }
})();
