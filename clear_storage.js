const page = window.location.origin;
// Open a new tab to execute localStorage clear
const newTab = window.open('about:blank', '_blank');
newTab.document.write(`
<script>
// Clear localStorage for the current domain
localStorage.clear();
alert('localStorage cleared. Close this tab and refresh the main page.');
</script>
`);
EOF < /dev/null