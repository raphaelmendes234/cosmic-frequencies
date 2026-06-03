import * as THREE from 'three'
import Experience from '../Experience'

export default class Stars
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.time = this.experience.time
        this.debug = this.experience.debug

        this.mode = 1
        
        this.setParameters()
        this.setGroup()
        this.setGeometry()
        this.setMaterial()
        this.setPoints()

        if(this.debug.active)
        {
            this.setDebug()
        }
    }

    setGroup()
    {
        this.group = new THREE.Group()
        this.scene.add(this.group)
    }

    setParameters()
    {
        this.p = {}
        // Quantités
        this.p.maxCount = 20000
        this.p.count = 5000

        // Zone d'apparition (Cube de -limit à +limit)
        this.p.limit = 50.0 

        // Tailles
        this.p.size = 3.0
        this.p.sizeRange = 0.8 // 0 = toutes de la même taille, 1 = écart maximal

        // Vitesse (calquée sur tes rayons)
        this.p.speed = 30.0 
        this.p.speedRandomness = 0.5 // Pour éviter que les étoiles bougent en bloc

        // Couleurs
        this.p.palettes = {
            pureWhite: [new THREE.Color('#ffffff'), new THREE.Color('#e0e0e0'), new THREE.Color('#ffffff')],
            starlight: [new THREE.Color('#ffffff'), new THREE.Color('#aaccff'), new THREE.Color('#ffeebb')], // Blanc, léger bleu, léger jaune
            deepSpace: [new THREE.Color('#3a0ca3'), new THREE.Color('#b5179e'), new THREE.Color('#48bfe3')],
        }
        this.p.activeColorMode = 'starlight' // Palette par défaut
        this.p.colorProgress = 1.0
        this.paletteNames = Object.keys(this.p.palettes)
    }

    setGeometry()
    {
        this.geometry = new THREE.BufferGeometry()

        const positions = new Float32Array(this.p.maxCount * 3)
        const randoms = new Float32Array(this.p.maxCount * 2) // x: speed, y: size
        const colorIndices = new Float32Array(this.p.maxCount)
     
        for (let i = 0; i < this.p.maxCount; i++) {
            // Position (X, Y, Z) réparties dans la limite cubique
            positions[i * 3 + 0] = (Math.random() - 0.5) * 2.0 * this.p.limit
            positions[i * 3 + 1] = (Math.random() - 0.5) * 2.0 * this.p.limit
            positions[i * 3 + 2] = (Math.random() - 0.5) * 2.0 * this.p.limit

            // Randoms pour varier la vitesse et la taille individuelle
            randoms[i * 2 + 0] = Math.random() // Pour moduler la vitesse
            randoms[i * 2 + 1] = Math.random() // Pour moduler la taille

            // Index pour la couleur (0, 1, ou 2)
            colorIndices[i] = Math.floor(Math.random() * 3)
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        this.geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 2))
        this.geometry.setAttribute('aColorIndex', new THREE.BufferAttribute(colorIndices, 1))
    }

    setMaterial()
    {
        this.material = new THREE.ShaderMaterial({
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            uniforms: {
                uTime: { value: 0 },
                uLimit: { value: this.p.limit },
                uSize: { value: this.p.size },
                uSizeRange: { value: this.p.sizeRange },
                uSpeed: { value: this.p.speed },
                uSpeedRandomness: { value: this.p.speedRandomness },
                uPalette1: { value: this.p.palettes[this.p.activeColorMode] },
                uPalette2: { value: this.p.palettes[this.p.activeColorMode] },
                uColorProgress: { value: this.p.colorProgress },
            },
            vertexShader: `
                uniform float uTime;
                uniform float uLimit;
                uniform float uSpeed;
                uniform float uSpeedRandomness;
                uniform float uSize;
                uniform float uSizeRange;

                attribute vec2 aRandom;
                attribute float aColorIndex;

                varying float vColorIndex;
                varying float vAlpha;

                void main() {
                    vec3 localPosition = position;

                    // 1. Défilement infini sur Z
                    // On varie un peu la vitesse de chaque particule grâce à aRandom.x
                    float currentMultiplier = mix(1.0, aRandom.x, uSpeedRandomness);
                    float zMovement = localPosition.z + uTime * uSpeed * currentMultiplier;
                    
                    // Logique du modulo pour faire boucler les étoiles de +limit à -limit
                    float totalDist = uLimit * 2.0;
                    float modZ = mod(zMovement + uLimit, totalDist) - uLimit;
                    localPosition.z = modZ;

                    // 2. Positionnement final
                    vec4 modelPosition = modelMatrix * vec4(localPosition, 1.0);
                    vec4 viewPosition = viewMatrix * modelPosition;
                    vec4 projectedPosition = projectionMatrix * viewPosition;
                    gl_Position = projectedPosition;

                    // 3. Taille des particules (atténuée par la perspective)
                    float particleSize = uSize * mix(1.0 - uSizeRange, 1.0, aRandom.y);
                    gl_PointSize = particleSize;

                    // 4. Variables pour le fragment
                    vColorIndex = aColorIndex;
                    
                    // Adoucir l'apparition/disparition aux limites Z pour éviter les clignotements
                    float distToLimit = uLimit - abs(localPosition.z);
                    vAlpha = smoothstep(0.0, 5.0, distToLimit);
                }
            `,
            fragmentShader: `
                uniform vec3 uPalette1[3];
                uniform vec3 uPalette2[3];
                uniform float uColorProgress;

                varying float vColorIndex;
                varying float vAlpha;

                void main() {
                    // Création d'une forme circulaire douce pour l'étoile
                    float distToCenter = distance(gl_PointCoord, vec2(0.5));
                    float circleAlpha = 1.0 - smoothstep(0.2, 0.5, distToCenter);
                    
                    // Si on est en dehors du cercle, on ne rend pas le pixel
                    if(distToCenter > 0.5) discard;

                    // Gestion des couleurs
                    int index = int(vColorIndex);
                    vec3 color1 = uPalette1[index];
                    vec3 color2 = uPalette2[index];
                    vec3 finalColor = mix(color1, color2, uColorProgress);

                    gl_FragColor = vec4(finalColor, circleAlpha * vAlpha);
                }
            `
        })
    }

    setPoints()
    {
        this.points = new THREE.Points(this.geometry, this.material)
        // L'astuce ici est de modifier la limite d'affichage si count change via GUI
        this.points.geometry.setDrawRange(0, this.p.count)
        this.group.add(this.points)
    }

    setMode(modeNumber)
    {
        this.mode = modeNumber

        // On calque exactement la rotation du groupe sur les modes de Beam.js
        if (this.mode === 1) {
            this.group.rotation.set(0, Math.PI, 0)
            this.p.size = 6.7
        } 
        else if (this.mode === 2) {
            this.group.rotation.set(Math.PI * 0.05, Math.PI + 0.5, 0)
            this.p.size = 3
        } 
        else if (this.mode === 3) {
            this.group.rotation.set(-Math.PI * 0.5, 0, 0)
            this.p.size = 3
        }
    }
    
    changeColorMode(modeName)
    {
        const currentColors = []
        for(let i = 0; i < 3; i++) {
            const c1 = this.material.uniforms.uPalette1.value[i]
            const c2 = this.material.uniforms.uPalette2.value[i]
            const mixedColor = new THREE.Color().copy(c1).lerp(c2, this.p.colorProgress)
            currentColors.push(mixedColor)
        }
        
        this.material.uniforms.uPalette1.value = currentColors
        this.material.uniforms.uPalette2.value = this.p.palettes[modeName]
        this.p.colorProgress = 0.0
    }

    setDebug()
    {
        this.debugFolder = this.debug.gui.addFolder("STARS")
        this.debugFolder.close()

        // Global
        const globalFolder = this.debugFolder.addFolder("global").close()
        globalFolder.add(this.p, "count").min(0).max(this.p.maxCount).step(1).name("count")
            .onChange((value) => { this.points.geometry.setDrawRange(0, value) })
        globalFolder.add(this.p, "limit").min(10).max(150).step(1).name("cube area size")

        // Sizes
        const sizeFolder = this.debugFolder.addFolder("size").close()
        sizeFolder.add(this.p, "size").min(1).max(100).step(0.1).name("base size")
        sizeFolder.add(this.p, "sizeRange").min(0).max(1).step(0.01).name("size randomness")

        // Speed
        const speedFolder = this.debugFolder.addFolder("speed").close()
        speedFolder.add(this.p, "speed").min(-100).max(100).step(0.1).name("speed")
        speedFolder.add(this.p, "speedRandomness").min(0).max(1).step(0.01).name("speed randomness")
        
        // Colors
        const colorFolder = this.debugFolder.addFolder("colors").close()
        colorFolder.add(this.p, 'activeColorMode', this.paletteNames).name('color palette')
            .onChange((newMode) => { this.changeColorMode(newMode) })
    }

    update()
    {
        const deltaTime = this.time.delta

        this.material.uniforms.uTime.value += deltaTime * 0.001
        
        // Maj des variables depuis le GUI
        this.material.uniforms.uLimit.value = this.p.limit
        this.material.uniforms.uSize.value = this.p.size
        this.material.uniforms.uSizeRange.value = this.p.sizeRange
        this.material.uniforms.uSpeed.value = this.p.speed
        this.material.uniforms.uSpeedRandomness.value = this.p.speedRandomness

        // Gestion du Crossfade des couleurs (exactement comme Beam.js)
        if (this.p.colorProgress < 1.0) {
            this.p.colorProgress += deltaTime * 0.002 
            if (this.p.colorProgress > 1.0) {
                this.p.colorProgress = 1.0
            }
            this.material.uniforms.uColorProgress.value = this.p.colorProgress
        }
    }
}