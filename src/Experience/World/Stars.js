import * as THREE from 'three'
import Experience from '../Experience.js'

export default class Stars
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.time = this.experience.time
        this.debug = this.experience.debug

        this.mode = "travelling"
        
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
        
        // Counts
        this.p.maxCount = 20000
        this.p.count = 5000

        // Spawn area (cube from -limit to +limit)
        this.p.limit = 50.0 

        // Sizes
        this.p.size = 3.0
        this.p.sizeRange = 0.8

        // Speed (matched to the beams)
        this.p.speed = 30.0 
        this.p.speedRandomness = 0.5

        // Colors
        this.p.palettes = {
            pureWhite: [new THREE.Color('#ffffff'), new THREE.Color('#e0e0e0'), new THREE.Color('#ffffff')],
            starlight: [new THREE.Color('#ffffff'), new THREE.Color('#aaccff'), new THREE.Color('#ffeebb')],
            deepSpace: [new THREE.Color('#3a0ca3'), new THREE.Color('#b5179e'), new THREE.Color('#48bfe3')],
        }
        this.p.activeColorMode = 'starlight' // Default palette
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
            // Position (X, Y, Z) spread within the cube
            positions[i * 3 + 0] = (Math.random() - 0.5) * 2.0 * this.p.limit
            positions[i * 3 + 1] = (Math.random() - 0.5) * 2.0 * this.p.limit
            positions[i * 3 + 2] = (Math.random() - 0.5) * 2.0 * this.p.limit

            // Randoms for per-star speed and size
            randoms[i * 2 + 0] = Math.random() // Modulates speed
            randoms[i * 2 + 1] = Math.random() // Modulates size

            // Color index (0, 1, or 2)
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

                    // 1. Infinite scroll on Z
                    // Vary each particle's speed via aRandom.x
                    float currentMultiplier = mix(1.0, aRandom.x, uSpeedRandomness);
                    float zMovement = localPosition.z + uTime * uSpeed * currentMultiplier;
                    
                    // Modulo to loop stars from +limit to -limit
                    float totalDist = uLimit * 2.0;
                    float modZ = mod(zMovement + uLimit, totalDist) - uLimit;
                    localPosition.z = modZ;

                    // 2. Final positioning
                    vec4 modelPosition = modelMatrix * vec4(localPosition, 1.0);
                    vec4 viewPosition = viewMatrix * modelPosition;
                    vec4 projectedPosition = projectionMatrix * viewPosition;
                    gl_Position = projectedPosition;

                    // 3. Particle size
                    float particleSize = uSize * mix(1.0 - uSizeRange, 1.0, aRandom.y);
                    gl_PointSize = particleSize;

                    // 4. Pass to fragment
                    vColorIndex = aColorIndex;
                    
                    // Fade in/out near Z limits to avoid popping
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
                    // Soft circular star shape
                    float distToCenter = distance(gl_PointCoord, vec2(0.5));
                    float circleAlpha = 1.0 - smoothstep(0.2, 0.5, distToCenter);
                    
                    // Discard pixels outside the circle
                    if(distToCenter > 0.5) discard;

                    // Colors
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
        // Draw range lets count change via the GUI
        this.points.geometry.setDrawRange(0, this.p.count)
        this.group.add(this.points)
    }

    setMode(name)
    {
        this.mode = name

        // Group rotation matched to Beam's modes
        if (this.mode === "travelling") {
            this.group.rotation.set(0, Math.PI, 0)
            this.p.size = 6.7
        } 
        else if (this.mode === "falling") {
            this.group.rotation.set(1.6, 0, -1)
            this.p.size = 3
        } 
        else if (this.mode === "closeup") {
            this.group.rotation.set(-0.5, 0, 0)
            this.p.size = 3
        }
        else if (this.mode === "eye") {
            this.group.rotation.set(-Math.PI * 0.5, 0, 0)
            this.p.size = 3
        }
        else if (this.mode === "far") {
            this.group.rotation.set(-0.8, -0.5, 0.6)
            this.p.size = 6.7
        }
    }

    show()
    {
        if(this.group) this.group.visible = true
    }

    hide()
    {
        if(this.group) this.group.visible = false
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
        if (!this.group || !this.group.visible) return

        const deltaTime = this.time.delta
        const elapsedTime = this.time.elapsed

        if (this.mode === "closeup") {
            this.group.rotation.y = Math.sin(elapsedTime * 0.001 * 0.5)
            this.group.rotation.x = Math.cos(elapsedTime * 0.001 * 0.5)
        }

        this.material.uniforms.uTime.value += deltaTime * 0.001
        
        // Update uniforms from the GUI
        this.material.uniforms.uLimit.value = this.p.limit
        this.material.uniforms.uSize.value = this.p.size
        this.material.uniforms.uSizeRange.value = this.p.sizeRange
        this.material.uniforms.uSpeed.value = this.p.speed
        this.material.uniforms.uSpeedRandomness.value = this.p.speedRandomness

        // Color crossfade (same as Beam.js)
        if (this.p.colorProgress < 1.0) {
            this.p.colorProgress += deltaTime * 0.002 
            if (this.p.colorProgress > 1.0) {
                this.p.colorProgress = 1.0
            }
            this.material.uniforms.uColorProgress.value = this.p.colorProgress
        }
    }
}