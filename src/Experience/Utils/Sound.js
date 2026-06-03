import Analyzer from '../../sounds/Analyzer.js'

export default class Sound
{
    constructor()
    {
        this.analyzer = new Analyzer()

        this.volume = 0
        this.volumeSmooth = 0
        this.kick = 0
        this.kickHard = 0
        this.volumeByFrequency = this.analyzer.volumeByFrequency // Float32Array

        // Average volume (all frequences)
        this.volumeAverage = 0
        this.volumeAverageSmooth = 0

        this.analyzer.onAudio((a) =>
        {
            this.volume = a.volume
            this.volumeSmooth = a.volumeSmooth
            this.kick = a.kick
            this.kickHard = a.kickHard
            // volumeByFrequency est mis à jour "en place", même référence
            
            // average volume
            let sum = 0
            const f = this.volumeByFrequency
            for (let i = 0; i < f.length; i++) sum += f[i]
            this.volumeAverage = sum / f.length

            this.volumeAverageSmooth += (this.volumeAverage - this.volumeAverageSmooth) * 0.1 // low = smooth, hight = reactive
        })
    }
}