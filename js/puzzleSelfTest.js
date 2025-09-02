// puzzleSelfTest.js
// Debug-only self-test for drag & drop behavior, separated from UI code
(function(){
  const DEBUG = true; // toggle if needed
  // DISABLE SELF-TEST UI: never inject the Self-test DnD controls in any environment
  const ENABLE_SELFTEST = false;
  if (!ENABLE_SELFTEST) {
    // keep the module loaded but no-op to ensure the button cannot be shown
    try { console.log('[SelfTest] disabled by configuration'); } catch (_) {}
    return;
  }

  function attachSelfTest(UIClassPrototype) {
    const buildControls = (container, grid) => {
      if (!grid) return;
      if (document.getElementById('puzzle-selftest-wrap')) return; // avoid duplicates anywhere
      const wrap = document.createElement('div');
      wrap.id = 'puzzle-selftest-wrap';
      wrap.style.display = 'flex';
      wrap.style.flexDirection = 'column';
      wrap.style.alignItems = 'center';
      wrap.style.gap = '8px';
      wrap.style.margin = '8px 0 0 0';
      const btn = document.createElement('button');
      btn.textContent = '🧪 Self-test DnD';
      btn.style.cssText = 'padding:6px 10px;border-radius:8px;border:1px solid #ccc;background:#fff;cursor:pointer;font-size:13px;';
      const copyBtn = document.createElement('button');
      copyBtn.textContent = 'Copy report';
      copyBtn.style.cssText = 'padding:6px 10px;border-radius:8px;border:1px solid #ccc;background:#fff;cursor:pointer;font-size:12px;display:none;';
      const out = document.createElement('textarea');
      out.readOnly = true;
      out.style.width = '100%';
      out.style.maxWidth = (grid.getBoundingClientRect().width | 0) + 'px';
      out.style.height = '160px';
      out.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
      out.style.fontSize = '12px';
      out.style.whiteSpace = 'pre';
      out.style.display = 'none';
      copyBtn.addEventListener('click', ()=>{ try{ out.select(); document.execCommand('copy'); }catch(_){} });
      // attach behavior into elements created
      const gridRef = grid;
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const getCellRect = (idx) => gridRef.children[idx].getBoundingClientRect();
      const center = (r) => ({ x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) });
      const getCellCenter = (idx) => center(getCellRect(idx));
      const getState = () => {
        const io = window.puzzleManager?.currentImageObj;
        return Array.isArray(io?.puzzleState) ? io.puzzleState.slice() : [];
      };
      const findTwoOccupied = () => { const st = getState(); const occ = []; for (let i=0;i<st.length;i++) if (st[i]!==null) occ.push(i); return occ.length>=2?[occ[0],occ[1]]:null; };
      const findOccupiedAndEmpty = () => { const st=getState(); let from=-1,to=-1; for(let i=0;i<st.length;i++) if(st[i]!==null){from=i;break;} for(let i=0;i<st.length;i++) if(st[i]===null){to=i;break;} return (from!==-1&&to!==-1)?[from,to]:null; };
      const dispatchMouse = (type, x, y, target, extra={}) => { const ev = new MouseEvent(type,{bubbles:true,cancelable:true,view:window,clientX:x,clientY:y,button:0,...extra}); (target||document).dispatchEvent(ev); };
      const captureLogs = async (fn) => { const orig=console.log; const bucket=[]; console.log=function(...args){ try{bucket.push(args);}catch(_){} try{orig.apply(console,args);}catch(_){} }; try{const result=await fn(); return {logs:bucket.slice(), result};} finally{ console.log=orig; } };
  const parseDropFromLogs = (logs) => { let entry={ type:null, fromIdx:null, toIdx:null, draggedPiece:null, hoverIdx:null }; for(const line of logs){ const msg=(typeof line[1]==='string')?line[1]:(typeof line[0]==='string'?line[0]:''); if(!msg) continue; let m=msg.match(/Comienza arrastre de pieza (\d+) \(celda (\d+)\)/); if(m){ entry.draggedPiece=parseInt(m[1]); continue; } m=msg.match(/Arrastrando sobre .* \(celda (\d+)\)/); if(m){ entry.hoverIdx=parseInt(m[1]); continue; } m=msg.match(/Intercambio \(arrastre\): pieza (\d+) \(celda (\d+)\) ↔ pieza (\d+) \(celda (\d+)\)/); if(m){ entry.type='swap'; entry.fromIdx=parseInt(m[2]); entry.toIdx=parseInt(m[4]); continue; } m=msg.match(/Mover \(arrastre\): pieza (\d+) de celda (\d+) a celda (\d+) \(vacía\)/); if(m){ entry.type='move'; entry.fromIdx=parseInt(m[2]); entry.toIdx=parseInt(m[3]); continue; } } return entry; };
      const diffIndices = (before, after) => { const changed=[]; for(let i=0;i<Math.max(before.length,after.length);i++) if(before[i]!==after[i]) changed.push(i); return changed; };
  const simulateDrag = async (fromIdx,toIdx) => { const fromCell=gridRef.children[fromIdx]; const fromCanvas=fromCell&&fromCell.querySelector('canvas'); if(!fromCanvas) return {ok:false,reason:'No canvas in source cell'}; const a=getCellCenter(fromIdx); const b=getCellCenter(toIdx); const draggedPieceDom = fromCanvas && fromCanvas.dataset ? fromCanvas.dataset.pieceIndex : null; dispatchMouse('mousedown',a.x,a.y,fromCanvas); await sleep(1); dispatchMouse('mousemove',a.x+6,a.y,document); await sleep(1); dispatchMouse('mousemove',Math.round((a.x+b.x)/2),Math.round((a.y+b.y)/2),document); await sleep(1); dispatchMouse('mousemove',b.x,b.y,document); await sleep(1); dispatchMouse('mouseup',b.x,b.y,document); await sleep(20); return {ok:true, draggedPieceDom}; };
      const simulateClickNoSwap = async (onIdx) => { const cell=gridRef.children[onIdx]; const canvas=cell&&cell.querySelector('canvas'); if(!canvas) return {ok:false,reason:'No canvas in cell'}; const a=getCellCenter(onIdx); dispatchMouse('mousedown',a.x,a.y,canvas); await sleep(1); dispatchMouse('mouseup',a.x,a.y,document); await sleep(10); return {ok:true}; };
  const runSelfTest = async () => { const io=window.puzzleManager?.currentImageObj; if(!io) return { error:'No current image object' }; const backup=Array.isArray(io.puzzleState)?io.puzzleState.slice():[]; const backupCompleted=!!io.completed; const report={ meta:{ time:new Date().toISOString() }, tests:[] }; const push=(e)=>report.tests.push(e); try { const occPair=findTwoOccupied(); if(occPair){ const [i,j]=occPair; const before=getState(); const {logs,result}=await captureLogs(()=>simulateDrag(i,j)); const after=getState(); const changed=diffIndices(before,after); const parsed=parseDropFromLogs(logs); const draggedPiece=before[i]; const draggedParticipates=changed.includes(i)||changed.includes(j)||changed.some(idx=>after[idx]===draggedPiece); const stateTargetOk = after[j] === draggedPiece; const domTargetCanvas = gridRef.children[j]?.querySelector('canvas'); const domTargetOk = domTargetCanvas && domTargetCanvas.dataset && domTargetCanvas.dataset.pieceIndex == String(draggedPiece); const hoverEqualsDrop = parsed.hoverIdx == null ? null : (parsed.hoverIdx === j); push({ name:'swap-occupied', fromIdx:i, toIdx:j, draggedPiece, changed, parsed, stateTargetOk, domTargetOk, hoverEqualsDrop, before: before.filter((_,x)=>changed.includes(x)), after: after.filter((_,x)=>changed.includes(x)), invariants:{ draggedParticipates, stateTargetOk, domTargetOk } }); } else { push({ name:'swap-occupied', skipped:true, reason:'Not enough occupied cells' }); } const occEmpty=findOccupiedAndEmpty(); if(occEmpty){ const [i,j]=occEmpty; const before=getState(); const {logs}=await captureLogs(()=>simulateDrag(i,j)); const after=getState(); const changed=diffIndices(before,after); const parsed=parseDropFromLogs(logs); const draggedPiece=before[i]; const draggedParticipates=changed.includes(i)||changed.includes(j)||changed.some(idx=>after[idx]===draggedPiece); const stateTargetOk = after[j] === draggedPiece && before[j] === null; const domTargetCanvas = gridRef.children[j]?.querySelector('canvas'); const domTargetOk = domTargetCanvas && domTargetCanvas.dataset && domTargetCanvas.dataset.pieceIndex == String(draggedPiece); const hoverEqualsDrop = parsed.hoverIdx == null ? null : (parsed.hoverIdx === j); push({ name:'move-to-empty', fromIdx:i, toIdx:j, draggedPiece, changed, parsed, stateTargetOk, domTargetOk, hoverEqualsDrop, before: before.filter((_,x)=>changed.includes(x)), after: after.filter((_,x)=>changed.includes(x)), invariants:{ draggedParticipates, stateTargetOk, domTargetOk } }); } else { push({ name:'move-to-empty', skipped:true, reason:'No empty cell available' }); } const anyOcc=getState().findIndex(v=>v!==null); if(anyOcc!==-1){ const before=getState(); await simulateClickNoSwap(anyOcc); const after=getState(); const changed=diffIndices(before,after); push({ name:'click-no-swap', onIdx:anyOcc, changed, invariant:{ noStateChange: changed.length===0 } }); } else { push({ name:'click-no-swap', skipped:true, reason:'No occupied cell' }); } } catch(err){ push({ name:'error', error:String(err&&err.message||err) }); } finally { try{ io.puzzleState=backup.slice(); io.completed=backupCompleted; if(window.findThePiecesApp){ window.findThePiecesApp.updateImageSilent(window.puzzleManager?.currentImageIndex ?? 0, { puzzleState: io.puzzleState, completed: io.completed, completedAt: io.completedAt }); } } catch(_){} } return report; };
      btn.addEventListener('click', async ()=>{ btn.disabled=true; const original=btn.textContent; btn.textContent='Running…'; try{ const report=await runSelfTest(); const text=JSON.stringify(report,null,2); out.value=text; out.style.display='block'; copyBtn.style.display='inline-block'; } finally { btn.disabled=false; btn.textContent=original; } });
      wrap.appendChild(btn); wrap.appendChild(copyBtn); wrap.appendChild(out);
      const gridWrapper = grid.parentElement;
      if (gridWrapper && gridWrapper.parentElement) {
        gridWrapper.insertAdjacentElement('afterend', wrap);
      } else if (container) {
        container.appendChild(wrap);
      } else {
        document.body.appendChild(wrap);
      }
    };
    const origRenderPuzzleGrid = UIClassPrototype.renderPuzzleGrid;
    UIClassPrototype.renderPuzzleGrid = function(imgObj, idx, puzzleData, container) {
      origRenderPuzzleGrid.call(this, imgObj, idx, puzzleData, container);
      if (!DEBUG) return;
      try {
        const grid = document.getElementById('puzzle-grid');
        if (!grid) { console.log('[SelfTest] grid not found after render'); return; }
        console.log('[SelfTest] injecting controls after render');
        buildControls(container, grid);
        setTimeout(()=>{ try{ const g2=document.getElementById('puzzle-grid'); if(g2) buildControls(container,g2);}catch(_){}} , 100);
      } catch(e){ console.warn('[SelfTest] injection failed:', e); }
    };
    // Inject immediately if a grid already exists (e.g., page loaded before patching)
    try {
      const grid = document.getElementById('puzzle-grid');
      if (grid) {
        console.log('[SelfTest] immediate grid found, building controls');
        const container = grid.closest('#puzzle-container') || (grid.parentElement ? grid.parentElement.parentElement : null);
        buildControls(container || document.getElementById('puzzle-container') || document.body, grid);
      } else {
        // Fallback: observe DOM for grid insertion for a short period
        console.log('[SelfTest] grid not found, observing DOM');
        const obs = new MutationObserver(() => {
          const g = document.getElementById('puzzle-grid');
          if (g) {
            try {
              const cont = g.closest('#puzzle-container') || (g.parentElement ? g.parentElement.parentElement : null);
              buildControls(cont || document.getElementById('puzzle-container') || document.body, g);
            } finally {
              try { obs.disconnect(); } catch(_) {}
            }
          }
        });
        try { obs.observe(document.body, { childList: true, subtree: true }); } catch(_) {}
        setTimeout(() => { try { obs.disconnect(); } catch(_) {} }, 8000);
      }
    } catch(_) {}
  }

  // Attach when UIManager exists (class or instance)
  const tryAttach = () => {
    if (window.__puzzleSelfTestAttached) return true;
    let proto = null;
    if (window && window.UIManager && window.UIManager.prototype) {
      proto = window.UIManager.prototype;
    } else if (window && window.uiManager && window.uiManager.constructor && window.uiManager.constructor.prototype) {
      proto = window.uiManager.constructor.prototype;
    }
    if (proto) {
      window.__puzzleSelfTestAttached = true;
      attachSelfTest(proto);
      return true;
    }
    return false;
  };
  if (!tryAttach()) {
    const iv = setInterval(() => { if (tryAttach()) clearInterval(iv); }, 100);
    setTimeout(()=>{ try{ clearInterval(iv);}catch(_){}} , 5000);
  }
})();
