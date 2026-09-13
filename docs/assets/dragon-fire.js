/* Dragon fire — canvas particle system.
   The jet is aimed from a live mouth anchor at the button's top edge, deflects
   on contact, and deposits heat that keeps the surface burning after the
   dragon has gone. Replaces the old SVG plume, which had no target. */
(function () {
  'use strict';

  /* ─────────── TUNABLES ─────────── */
  var CFG = {
    jetWidth:           0.24,  // cone half-angle at the mouth (radians)
    jetDuration:        0.23,  // s of particle flight — sets speed so life ends ON impact
    jetRate:            185,   // jet particles per second
    sweepSpeed:         1.0,   // how far ahead of the mouth the impact point rides
    lead:               38,    // px of that lead at sweepSpeed 1
    heatDecayRate:      0.30,  // heat units per second
    scorchDecayRate:    0.13,  // slower, so marks outlive the flames (~2s)
    coolDownDuration:   3000,  // ms from dragon-at-rest to cold
    surfaceFlameHeight: 16,    // px band above the edge
    glowIntensity:      1.0,
    segments:           24,
    maxJet:             400,
    maxSurface:         180
  };

  /* Colour ramp — read from CSS custom properties, these are only fallbacks. */
  var C = {
    core:'#FFFFFF', hot:'#E8D5FF', mid:'#A855F7', deep:'#6D5AE6',
    fade:'#3B1E6E', smoke:'#1A1030', ember:'#C77DFF', scorch:'#2A1240', spill:'#FFD9F5'
  };

  var host = document.querySelector('.dragon-host');
  var cvs  = host && host.querySelector('.dfire');
  var btnEl= host && host.querySelector('.fx-dragon');
  var mouth= host && host.querySelector('.dragon-mouth');
  var dg   = host && host.querySelector('.dg');
  if (!host || !cvs || !btnEl || !mouth) return;

  var css = getComputedStyle(document.documentElement);
  Object.keys(C).forEach(function (k) {
    var v = css.getPropertyValue('--flame-' + k).trim() || css.getPropertyValue('--' + k).trim();
    if (v) C[k] = v;
  });

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ctx = cvs.getContext('2d');
  var dpr = Math.min(devicePixelRatio || 1, 2);

  /* ─────────── sprite atlas: 20 tinted radial blobs along the ramp ─────────── */
  var STOPS = [[0,C.core],[0.12,C.hot],[0.34,C.mid],[0.60,C.deep],[0.82,C.fade],[1,C.smoke]];
  function hex(h){h=h.replace('#','');if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
  function rampAt(t){
    for(var i=1;i<STOPS.length;i++){ if(t<=STOPS[i][0]){
      var a=STOPS[i-1],b=STOPS[i],f=(t-a[0])/(b[0]-a[0]),ca=hex(a[1]),cb=hex(b[1]);
      return [ca[0]+(cb[0]-ca[0])*f|0, ca[1]+(cb[1]-ca[1])*f|0, ca[2]+(cb[2]-ca[2])*f|0];
    }}
    return hex(C.smoke);
  }
  var TILES=20, TS=34, atlas=document.createElement('canvas');
  atlas.width=TS*TILES; atlas.height=TS;
  (function(){
    var a=atlas.getContext('2d');
    for(var i=0;i<TILES;i++){
      var rgb=rampAt(i/(TILES-1)), cx=i*TS+TS/2;
      var g=a.createRadialGradient(cx,TS/2,0,cx,TS/2,TS/2);
      g.addColorStop(0,'rgba('+rgb+',1)');
      g.addColorStop(0.45,'rgba('+rgb+',0.55)');
      g.addColorStop(1,'rgba('+rgb+',0)');
      a.fillStyle=g; a.fillRect(i*TS,0,TS,TS);
    }
  })();

  /* ─────────── pooled particles ─────────── */
  var JET=0, SPLASH=1, SURF=2, EMBER=3, SMOKE=4;
  function mk(){return{on:false,x:0,y:0,vx:0,vy:0,t:0,life:1,r:4,k:JET,seed:0};}
  var pool=[], POOLMAX=CFG.maxJet+CFG.maxSurface+160;
  for(var i=0;i<POOLMAX;i++) pool.push(mk());
  var nJet=0,nSurf=0;
  function spawn(k){
    if(k===JET&&nJet>=CFG.maxJet) return null;
    if(k===SURF&&nSurf>=CFG.maxSurface) return null;
    for(var i=0;i<POOLMAX;i++){var p=pool[i];if(!p.on){
      p.on=true;p.k=k;p.t=0;p.seed=Math.random();
      if(k===JET)nJet++; else if(k===SURF)nSurf++;
      return p;}}
    return null;
  }
  function kill(p){ if(p.k===JET)nJet--; else if(p.k===SURF)nSurf--; p.on=false; }

  /* ─────────── geometry, cached and invalidated deliberately ─────────── */
  var G={cw:0,ch:0,bx:0,by:0,bw:0,bh:0}, dirty=true;
  function measure(){
    var cr=cvs.getBoundingClientRect(), br=btnEl.getBoundingClientRect();
    G.cw=cr.width; G.ch=cr.height;
    G.bx=br.left-cr.left; G.by=br.top-cr.top; G.bw=br.width; G.bh=br.height;
    if(cvs.width!==Math.round(G.cw*dpr)||cvs.height!==Math.round(G.ch*dpr)){
      cvs.width=Math.round(G.cw*dpr); cvs.height=Math.round(G.ch*dpr);
    }
    dirty=false;
  }
  function invalidate(){ dirty=true; }
  addEventListener('resize',invalidate,{passive:true});
  addEventListener('scroll',invalidate,{passive:true});
  if(window.ResizeObserver){ new ResizeObserver(invalidate).observe(btnEl); new ResizeObserver(invalidate).observe(cvs); }

  /* ─────────── heat map ─────────── */
  var N=CFG.segments, heat=new Float32Array(N), scorch=new Float32Array(N), acc=new Float32Array(N);
  function segAt(xLocal){ return Math.max(0,Math.min(N-1,Math.floor((xLocal-G.bx)/G.bw*N))); }

  /* ─────────── state ─────────── */
  var IDLE=0,APPROACH=1,BREATHING=2,BURNING=3,COOLING=4;
  var state=IDLE, restedAt=0, visible=true;
  if(window.IntersectionObserver) new IntersectionObserver(function(e){visible=e[0].isIntersecting;},{threshold:0}).observe(host);

  var last=performance.now();
  function frame(now){
    var dt=Math.min(now-last,50)/1000; last=now;
    requestAnimationFrame(frame);
    if(!visible) return;
    if(dirty) measure();
    if(!G.bw) return;

    var mr=mouth.getBoundingClientRect(), cr=cvs.getBoundingClientRect();
    var mx=mr.left+mr.width/2-cr.left, my=mr.top+mr.height/2-cr.top;
    var L=G.bx, R=G.bx+G.bw, surfaceY=G.by;

    /* state derives from where the dragon actually is — never desyncs */
    var prev=state;
    if(mx<L-70)              state=APPROACH;
    else if(mx<=R+18)        state=BREATHING;
    else if(mx<G.cw+40)      state=BURNING;
    else                     state=COOLING;
    if(prev!==COOLING&&state===COOLING) restedAt=now;
    if(state===COOLING&&now-restedAt>CFG.coolDownDuration) state=IDLE;

    if(!reduce){ emit(dt,mx,my,L,R,surfaceY,now); update(dt,surfaceY,L,R); }
    decay(dt);
    render(surfaceY,L,R,mx);
  }

  var emitAcc=0;
  function emit(dt,mx,my,L,R,surfaceY,now){
    if(state===BREATHING){
      var impactX=Math.max(L+4,Math.min(R-4,mx+CFG.lead*CFG.sweepSpeed));
      var dx=impactX-mx, dy=surfaceY-my, dist=Math.hypot(dx,dy), aim=Math.atan2(dy,dx);
      /* head looks at what it is burning */
      if(dg) dg.style.setProperty('--head-rot',(Math.max(8,Math.min(26,aim*180/Math.PI*0.7)))+'deg');
      emitAcc+=CFG.jetRate*dt;
      while(emitAcc>=1){
        emitAcc--;
        var p=spawn(JET); if(!p) break;
        var flight=CFG.jetDuration*(0.86+Math.random()*0.28);
        var ang=aim+(Math.random()-0.5)*2*CFG.jetWidth;
        p.x=mx; p.y=my; p.life=flight;
        p.vx=Math.cos(ang)*dist/flight; p.vy=Math.sin(ang)*dist/flight;
        p.r=1.9+Math.random()*2.4;
      }
    } else if(dg && state!==BURNING){ dg.style.setProperty('--head-rot','0deg'); }

    /* surface burn — spawn rate, height and brightness all scale with heat */
    for(var i=0;i<N;i++){
      if(heat[i]<=0.02) continue;
      acc[i]+=heat[i]*heat[i]*20*dt;
      while(acc[i]>=1){
        acc[i]--;
        var s=spawn(SURF); if(!s) break;
        s.x=G.bx+(i+Math.random())*(G.bw/N); s.y=surfaceY+1;
        s.vx=(Math.random()-0.5)*16; s.vy=-(11+heat[i]*24)*(0.7+Math.random()*0.6);
        s.life=0.30+heat[i]*0.34; s.r=1.5+heat[i]*2.6;
      }
      if(heat[i]>0.55&&Math.random()<heat[i]*dt*7){
        var e=spawn(EMBER); if(e){ e.x=G.bx+(i+Math.random())*(G.bw/N); e.y=surfaceY-2;
          e.vx=(Math.random()-0.5)*20; e.vy=-(26+Math.random()*34);
          e.life=0.8+Math.random()*0.9; e.r=1.2+Math.random()*1.4; }
      }
    }
    /* cooling: residual scorch gives off smoke, never an abrupt cut */
    if(state===COOLING||state===IDLE){
      for(var j=0;j<N;j++){
        if(scorch[j]>0.12&&Math.random()<scorch[j]*dt*3){
          var k=spawn(SMOKE); if(k){ k.x=G.bx+(j+Math.random())*(G.bw/N); k.y=surfaceY-1;
            k.vx=(Math.random()-0.5)*11; k.vy=-(9+Math.random()*15);
            k.life=1.1+Math.random()*1.0; k.r=4+Math.random()*6; }
        }
      }
    }
  }

  function update(dt,surfaceY,L,R){
    for(var i=0;i<POOLMAX;i++){
      var p=pool[i]; if(!p.on) continue;
      p.t+=dt;
      if(p.t>=p.life){ kill(p); continue; }
      p.x+=p.vx*dt; p.y+=p.vy*dt;

      if(p.k===JET){
        /* IMPACT: deflect along the surface instead of passing through it */
        if(p.y>=surfaceY&&p.x>L-14&&p.x<R+14){
          var sp=Math.hypot(p.vx,p.vy), dir=p.vx>=0?1:-1;
          var idx=segAt(p.x);
          heat[idx]=Math.min(1,heat[idx]+0.028);
          if(idx>0)   heat[idx-1]=Math.min(1,heat[idx-1]+0.011);
          if(idx<N-1) heat[idx+1]=Math.min(1,heat[idx+1]+0.011);
          scorch[idx]=Math.max(scorch[idx],heat[idx]);
          p.k=SPLASH; nJet--;
          p.y=surfaceY; p.t=0; p.life=0.30+Math.random()*0.26;
          p.vx=dir*sp*(0.42+Math.random()*0.3)*(Math.random()<0.18?-1:1);
          p.vy=-sp*(0.10+Math.random()*0.14);          /* slight buoyancy */
          p.r=1.7+Math.random()*2.1;
        }
      } else if(p.k===SPLASH){
        p.vy+=42*dt; p.vx*=(1-1.5*dt);
        if(p.y>surfaceY){ p.y=surfaceY; p.vy=-Math.abs(p.vy)*0.32; }
      } else if(p.k===SURF){
        p.vy-=26*dt; p.vx+=Math.sin((p.t+p.seed)*11)*17*dt;
      } else if(p.k===EMBER){
        p.vy+=9*dt; p.vx+=Math.sin((p.t+p.seed)*6)*11*dt;
      } else {                                          /* SMOKE */
        p.vy-=5*dt; p.vx+=Math.sin((p.t+p.seed)*3)*7*dt; p.r+=7*dt;
      }
    }
  }

  function decay(dt){
    for(var i=0;i<N;i++){
      heat[i]=Math.max(0,heat[i]-CFG.heatDecayRate*dt);
      scorch[i]=Math.max(0,scorch[i]-CFG.scorchDecayRate*dt);
    }
  }

  function render(surfaceY,L,R,mx){
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,G.cw,G.ch);
    var segW=G.bw/N;

    if(reduce){                                          /* static glow, no particles */
      ctx.globalCompositeOperation='lighter';
      var rg=ctx.createLinearGradient(0,surfaceY-14,0,surfaceY+G.bh*0.34);
      rg.addColorStop(0,'rgba(168,85,247,0.34)'); rg.addColorStop(1,'rgba(168,85,247,0)');
      ctx.fillStyle=rg; ctx.fillRect(L,surfaceY-14,G.bw,G.bh*0.34+14);
      ctx.globalCompositeOperation='source-over'; return;
    }

    /* scorch — darkens the fill under the burn (single canvas, so alpha not multiply) */
    ctx.globalCompositeOperation='source-over';
    for(var i=0;i<N;i++){
      if(scorch[i]<=0.02) continue;
      var sc=ctx.createRadialGradient(G.bx+(i+0.5)*segW,surfaceY+2,0,G.bx+(i+0.5)*segW,surfaceY+2,segW*1.5);
      sc.addColorStop(0,'rgba('+hex(C.scorch)+','+(scorch[i]*0.30).toFixed(3)+')');
      sc.addColorStop(1,'rgba('+hex(C.scorch)+',0)');
      ctx.fillStyle=sc; ctx.fillRect(G.bx+(i+0.5)*segW-segW*1.5,surfaceY,segW*3,10+scorch[i]*8);
    }

    /* light SPILL into the top third — warm white-pink, so it reads lit not tinted */
    ctx.globalCompositeOperation='lighter';
    var spill=hex(C.spill);
    for(var s=0;s<N;s++){
      if(heat[s]<=0.03) continue;
      var g2=ctx.createRadialGradient(G.bx+(s+0.5)*segW,surfaceY,0,G.bx+(s+0.5)*segW,surfaceY,segW*1.9);
      g2.addColorStop(0,'rgba('+spill+','+(heat[s]*0.52*CFG.glowIntensity).toFixed(3)+')');
      g2.addColorStop(1,'rgba('+spill+',0)');
      ctx.fillStyle=g2; ctx.fillRect(G.bx+(s+0.5)*segW-segW*1.9,surfaceY,segW*3.8,G.bh*0.46);
      /* bloom above the edge, wider than on it, to carry against the dark bg */
      var g3=ctx.createRadialGradient(G.bx+(s+0.5)*segW,surfaceY,0,G.bx+(s+0.5)*segW,surfaceY,13+heat[s]*15);
      g3.addColorStop(0,'rgba('+hex(C.mid)+','+(heat[s]*0.12*CFG.glowIntensity).toFixed(3)+')');
      g3.addColorStop(1,'rgba('+hex(C.mid)+',0)');
      ctx.fillStyle=g3; ctx.fillRect(G.bx+(s+0.5)*segW-56,surfaceY-56,112,72);
    }
    /* thin dark rim where flame base meets the edge, to separate from the fill */
    for(var d=0;d<N;d++){
      if(heat[d]<=0.05) continue;
      ctx.globalCompositeOperation='source-over';
      ctx.fillStyle='rgba('+hex(C.deep)+','+(heat[d]*0.34).toFixed(3)+')';
      ctx.fillRect(G.bx+d*segW,surfaceY-1,segW+1,1.6);
      ctx.globalCompositeOperation='lighter';
    }

    /* hot particles additively, embers and smoke normally */
    for(var pass=0;pass<2;pass++){
      ctx.globalCompositeOperation = pass===0 ? 'lighter' : 'source-over';
      for(var q=0;q<POOLMAX;q++){
        var p=pool[q]; if(!p.on) continue;
        var hot=(p.k===JET||p.k===SPLASH||p.k===SURF);
        if((pass===0)!==hot) continue;
        var t=p.t/p.life, tile;
        if(p.k===EMBER) tile=TILES-9;
        else if(p.k===SMOKE) tile=TILES-1;
        else tile=Math.min(TILES-1,(t*(TILES-1))|0);
        var a=p.k===SMOKE?(1-t)*0.14:(p.k===EMBER?(1-t)*0.7:(1-t)*0.62);
        var r=p.r*(p.k===SMOKE?1+t*1.6:1+t*0.7);
        ctx.globalAlpha=Math.max(0,a);
        ctx.drawImage(atlas,tile*TS,0,TS,TS,p.x-r,p.y-r,r*2,r*2);
      }
    }
    ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
  }

  measure();
  requestAnimationFrame(frame);
})();
