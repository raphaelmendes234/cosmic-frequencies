import * as THREE from 'three'

import Experience from "./Experience";

// Effect composer
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
// Passes
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

// Shaders
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js'

export default class PostProcessing
{
    constructor()
    {
        this.experience = new Experience()
        this.sizes = this.experience.sizes
        this.scene = this.experience.scene
        this.time = this.experience.time
        this.camera = this.experience.camera.instance
        this.renderer = this.experience.renderer.instance
        this.debug = this.experience.debug
        this.sound = this.experience.sound

        // CRT pass
        this.aberrationStrength = 0.05
        this.transition = 1             // 1 = écran fermé (on démarre coupé pendant le chargement)
        this.phase = 'closed'           // état courant de l'animation
        this.t = 0                      // durée d'une coupure complète, en secondes
        this.transitionDuration = 0.2   // durée d'une coupure complète (s)
        this.onPeak = null              // callback à exécuter quand l'écran est fermé (pour switcher)
        this.peakFired = false          // évite d'appeler onPeak plusieurs fois

        // ouvre l'écran quand les assets sont chargés
        this.experience.ressources.on('loaded', () => { this.phase = 'opening'; this.t = 0 })

        // Black and white pass
        this.bw = 0
        this.bwTimer = 0
        this.bwHold = 0             // temps restant d'affichage du N&B
        this.bwDuration = 0.6       // durée du flash (s)
        this.bwBaseInterval = 4     // intervalle quand le son est faible (s)
        this.bwAmount = 40          // accélération selon le volume (monter pour faire clignoter les passages forts)

        this.contrast = 1.1

        // Set up
        this.setRenderTarget()
        this.setEffectComposer()
        this.setRenderPass()

        // Passes
        this.setUnrealBloomPass()
        this.setCRTPass()
        this.setBlackWhitePass()

        // Corrections passes
        this.setGammaCorrectionPass()
        this.setSMAAPass()
    }

    setRenderTarget() {
        this.renderTarget = new THREE.WebGLRenderTarget(
            800,
            600,
            {
                samples: this.renderer.getPixelRatio() === 1 ? 2 : 0
            }
        )
    }

    setEffectComposer() {
        this.effectComposer = new EffectComposer(this.renderer, this.renderTarget)
        this.effectComposer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.effectComposer.setSize(this.sizes.width, this.sizes.height)
    }

    setRenderPass() {
        this.renderPass = new RenderPass(this.scene, this.camera)
        this.effectComposer.addPass(this.renderPass)
    }

    setUnrealBloomPass() {
        this.unrealBloomPass = new UnrealBloomPass()
        this.unrealBloomPass.strength = 0.2
        this.unrealBloomPass.radius = 2
        this.unrealBloomPass.threshold = 0.5
        this.unrealBloomPass.enabled = true
        this.effectComposer.addPass(this.unrealBloomPass)

        if (this.debug.active) {
            this.debugFolder = this.debug.gui.addFolder("POST PROCESSING")
            this.debugFolder.close()
            this.debugFolder.add(this.unrealBloomPass, "strength").min(0).max(2).step(0.001)
            this.debugFolder.add(this.unrealBloomPass, "radius").min(0).max(2).step(0.001)
            this.debugFolder.add(this.unrealBloomPass, "threshold").min(0).max(1).step(0.001)
        }
    }

    triggerTransition(onPeak)
    {
        // Lance une coupure complète : se ferme puis se rouvre
        this.phase = 'pulsing'
        this.t = 0
        this.onPeak = onPeak       // appelé au moment fermé (pour switcher le plan)
        this.peakFired = false
    }

    setCRTPass() {
        const CRTPass = {
            uniforms: {
                tDiffuse: { value: null },
                uCurvature: { value: 4.2 },
                uBorder: { value: 0.05 },
                uAberration: { value: 0.05 },
                uGrain: { value: 0.0 },
                uTime: { value: 0 },
                uTransition: { value: 1 }
            },
            vertexShader: `
                varying vec2 vUv;

                void main(){
                    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
                    vUv = uv;
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float uCurvature;
                uniform float uBorder;
                uniform float uAberration;
                uniform float uGrain;
                uniform float uTime;
                uniform float uTransition;
                varying vec2 vUv;

                float rand(vec2 co){
                    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
                }

                float hash12(vec2 p){
                    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
                    p3 += dot(p3, p3.yzx + 33.33);
                    return fract((p3.x + p3.y) * p3.z);
                }

                vec2 curve(vec2 uv){
                    uv = uv * 2.0 - 1.0;
                    vec2 offset = abs(uv.yx) / uCurvature;
                    uv = uv + uv * offset * offset;   // bombe l'image (tube)
                    return uv * 0.5 + 0.5;
                }

                void main(){
                    vec2 uv = curve(vUv);

                    // --- Coupure CRT : on comprime l'image dans une bande horizontale ---
                    // openY = hauteur visible de l'écran (1 = ouvert, 0 = fermé en ligne)
                    float openY = 1.0 - uTransition;
                    // on "étire" la bande visible vers la coordonnée réelle de la texture :
                    // quand openY est petit, seul le centre (y~0.5) tombe dans [0,1]
                    float y = (uv.y - 0.5) / max(openY, 0.0001) + 0.5;
                    vec2 tuv = vec2(uv.x, y);

                    // Aberration chromatique : on échantillonne R et B décalés vers les bords
                    vec2 ca = (tuv - 0.5) * uAberration;
                    float r = texture2D(tDiffuse, tuv - ca).r;
                    float g = texture2D(tDiffuse, tuv).g;
                    float b = texture2D(tDiffuse, tuv + ca).b;
                    vec4 color = vec4(r, g, b, 1.0);

                    // Grain : bruit blanc par pixel, animé par uTime
                    float noise = hash12(gl_FragCoord.xy + fract(uTime) * 100.0);
                    color.rgb += (noise - 0.5) * uGrain;

                    // Tout ce qui sort de la bande visible passe en noir
                    if (y < 0.0 || y > 1.0) color.rgb = vec3(0.0);

                    // Glow : une ligne lumineuse au centre, d'autant plus forte que l'écran est fermé
                    float glow = smoothstep(openY * 0.5, 0.0, abs(uv.y - 0.5));
                    color.rgb += glow * uTransition * 0.4;

                    // Cadre noir arrondi de la télé
                    vec2 edge = smoothstep(0.0, uBorder, uv) * (1.0 - smoothstep(1.0 - uBorder, 1.0, uv));
                    color.rgb *= edge.x * edge.y;

                    gl_FragColor = color;
                }
            `,
        }

        this.crtPass = new ShaderPass(CRTPass)
        this.crtPass.enabled = true
        this.effectComposer.addPass(this.crtPass)

        if (this.debug.active) {
            const f = this.debug.gui.addFolder("CRT")
            f.close()
            f.add(this.crtPass.material.uniforms.uCurvature, "value").min(2.5).max(10).step(0.1).name("courbure")
            f.add(this.crtPass.material.uniforms.uBorder, "value").min(0).max(0.3).step(0.005).name("bordure")
            f.add(this, "aberrationStrength").min(0).max(0.1).step(0.001).name("aberration")
            f.add(this.crtPass.material.uniforms.uGrain, "value").min(0).max(10).step(0.005).name("grain")
        }
    }

    setBlackWhitePass() {
        const BlackWhitePass = {
            uniforms: {
                tDiffuse: { value: null },
                uBW: { value: 0 },      // 0 = normal, 1 = noir & blanc
                uContrast: { value: this.contrast }
            },
            vertexShader: `
                varying vec2 vUv;
                void main(){
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float uBW;
                uniform float uContrast;
                varying vec2 vUv;
                void main(){
                    vec4 c = texture2D(tDiffuse, vUv);
                    float gray = dot(c.rgb, vec3(0.299, 0.587, 0.114));         // luminance
                    gray = clamp((gray - 0.5) * uContrast + 0.5, 0.0, 1.0);     // punch : écarte du gris moyen
                    c.rgb = mix(c.rgb, vec3(gray), uBW);
                    gl_FragColor = c;
                }
            `,
        }
        this.bwPass = new ShaderPass(BlackWhitePass)
        this.bwPass.enabled = true
        this.effectComposer.addPass(this.bwPass)
    }

    setGammaCorrectionPass() {
        this.gammaCorrectionPass = new ShaderPass(GammaCorrectionShader)
        this.gammaCorrectionPass.enabled = true
        this.effectComposer.addPass(this.gammaCorrectionPass)
    }

    setSMAAPass() {
        if (this.renderer.getPixelRatio() === 1 && !this.renderer.capabilities.isWebGL2) {
            this.smaaPass = new SMAAPass()
            this.effectComposer.addPass(this.smaaPass)
            console.log("Using SMAA")
        }
    }

    resize() {
        this.effectComposer.setSize(this.sizes.width, this.sizes.height)
        this.effectComposer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    }

    update() {
        const dt = this.time.delta * 0.001

        /**
         * CRT pass
         */
        if (this.phase === 'closed') {
            this.transition = 1                                 // reste fermé tant que ça charge
        } else if (this.phase === 'opening') {                  // chargement terminé : ouverture 1 → 0
            this.t += dt / this.transitionDuration
            this.transition = 1 - Math.min(this.t, 1)
            if (this.t >= 1) this.phase = 'idle'
        } else if (this.phase === 'pulsing') {                  // changement de plan : ferme (0→1) puis ouvre (1→0)
            this.t += dt / this.transitionDuration
            const x = Math.min(this.t, 1)
            this.transition = 1 - Math.abs(x * 2 - 1)           // courbe triangle : pic à mi-parcours
            // à mi-chemin (écran fermé), on déclenche le switch une seule fois
            if (!this.peakFired && x >= 0.5) { this.peakFired = true; if (this.onPeak) this.onPeak() }
            if (this.t >= 1) this.phase = 'idle'
        } else {
            this.transition = 0                                 // idle : écran normal
        }
        this.crtPass.material.uniforms.uTransition.value = this.transition
        this.crtPass.material.uniforms.uAberration.value = this.sound.kickHard * this.aberrationStrength
        this.crtPass.material.uniforms.uTime.value = this.time.elapsed * 0.001

        /**
         *  black and white
         */
        const boost = Math.pow(this.sound.volumeAverageSmooth, 2.0) * this.bwAmount
        const bwInterval = Math.max(this.bwBaseInterval / (1 + boost), 0.1)

        if (this.bwHold > 0) {
            this.bwHold -= dt
            this.bw = this.bwHold > 0 ? 1 : 0
        } else {
            this.bwTimer += dt
            if (this.bwTimer >= bwInterval) {
                this.bwHold = Math.max(this.bwDuration / (1 + boost), 0.1)   // jamais sous 0.1s
                this.bwTimer = 0
            }
        }

        this.bwPass.material.uniforms.uBW.value = this.bw

        this.effectComposer.render()
    }

    dispose() {
        this.effectComposer.dispose()
        this.unrealBloomPass.dispose()
        if (this.smaaPass) {
            this.smaaPass.dispose()
        }
    }
}