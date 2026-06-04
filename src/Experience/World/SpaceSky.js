import * as THREE from 'three'
import Experience from '../Experience'

export default class SpaceSky
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.time = this.experience.time
        this.debug = this.experience.debug
        this.camera = this.experience.camera

        this.setParameters()
        this.setMesh()

        if (this.debug.active) this.setDebug()
    }

    setParameters()
    {
        this.p = {
            scale: 2.0,        // fréquence du bruit (plus grand = nuages plus petits)
            speed: 0.4,       // vitesse d'ondulation (lent)
            warp: 0.6,         // intensité des volutes
            threshold: 0.34,   // densité (plus haut = plus de vide noir)
            colorDeep: '#05030f',
            colorA: '#3a1a6e',
            colorB: '#5a276d',
            softness: 0.56,
            opacity: 1.0,
        }
    }

    setMesh()
    {
        const geometry = new THREE.SphereGeometry(10, 32, 32)

        this.mat = new THREE.ShaderMaterial({
            side: THREE.BackSide,     // on regarde l'intérieur
            depthWrite: false,        // n'écrit pas dans le depth
            depthTest: false,         // toujours rendu en fond
            uniforms: {
                uTime: { value: 0 },
                uScale: { value: this.p.scale },
                uSpeed: { value: this.p.speed },
                uWarp: { value: this.p.warp },
                uThreshold: { value: this.p.threshold },
                uColorDeep: { value: new THREE.Color(this.p.colorDeep) },
                uColorA: { value: new THREE.Color(this.p.colorA) },
                uColorB: { value: new THREE.Color(this.p.colorB) },
                uSoftness: { value: this.p.softness },
            },
            vertexShader: `
                varying vec3 vDir;
                void main(){
                    vDir = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vDir;
                uniform float uTime, uScale, uSpeed, uWarp, uThreshold, uSoftness;
                uniform vec3 uColorDeep, uColorA, uColorB;

                float hash(vec3 p){
                    p = fract(p * 0.3183099 + 0.1);
                    p *= 17.0;
                    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
                }
                float noise(vec3 x){
                    vec3 i = floor(x);
                    vec3 f = fract(x);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(
                        mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
                            mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                        mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                            mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y),
                        f.z);
                }
                float fbm(vec3 p){
                    float v = 0.0; float a = 0.5;
                    for(int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.0; a *= 0.5; }
                    return v;
                }

                void main(){
                    vec3 dir = normalize(vDir);
                    vec3 p = dir * uScale;
                    float t = uTime * uSpeed;

                    // domain warp → volutes qui ondulent
                    vec3 warp = vec3(fbm(p + t), fbm(p + t + 4.7), fbm(p + t + 9.2));
                    float n = fbm(p + warp * uWarp + t * 0.5);

                    n = smoothstep(uThreshold, uThreshold + uSoftness, n);                 // densité

                    vec3 color = mix(uColorDeep, uColorA, n);          // premiers nuages
                    color = mix(color, uColorB, smoothstep(0.4, 1.0, n)); // cœurs lumineux

                    gl_FragColor = vec4(color, 1.0);
                }
            `
        })

        this.mesh = new THREE.Mesh(geometry, this.mat)
        this.mesh.renderOrder = -1     // dessiné en premier (fond)
        this.scene.add(this.mesh)
    }

    setDebug()
    {
        this.debugFolder = this.debug.gui.addFolder("SKY")
        this.debugFolder.close()
        const u = this.mat.uniforms

        this.debugFolder.add(this.p, 'scale', 0.2, 5, 0.01).onChange(v => u.uScale.value = v)
        this.debugFolder.add(this.p, 'speed', 0, 10, 0.001).onChange(v => u.uSpeed.value = v)
        this.debugFolder.add(this.p, 'warp', 0, 2, 0.01).onChange(v => u.uWarp.value = v)
        this.debugFolder.add(this.p, 'threshold', 0, 1, 0.01).onChange(v => u.uThreshold.value = v)
        this.debugFolder.addColor(this.p, 'colorDeep').onChange(v => u.uColorDeep.value.set(v))
        this.debugFolder.addColor(this.p, 'colorA').onChange(v => u.uColorA.value.set(v))
        this.debugFolder.addColor(this.p, 'colorB').onChange(v => u.uColorB.value.set(v))
        this.debugFolder.add(this.p, 'softness', 0.05, 1, 0.01).onChange(v => u.uSoftness.value = v)
    }

    update()
    {
        this.mat.uniforms.uTime.value = this.time.elapsed * 0.001
        this.mesh.position.copy(this.camera.instance.position)   // fond "infini" centré sur la caméra
    }
}