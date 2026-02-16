import { useState, useEffect, useRef } from 'react'
import OBR from '@owlbear-rodeo/sdk'

const rollDice = (sides) => {
  const result = Math.floor(Math.random() * sides) + 1
  console.log(`🎲 Rolling d${sides}: ${result}`)
  return result
}

const createEmptyCharacter = () => ({
  name: 'New Character',
  level: 1,
  stats: {
    constitution: { base: 10, xp: 0 },
    force: { base: 10, xp: 0 },
    intelligence: { base: 10, xp: 0 },
    perception: { base: 10, xp: 0 },
    social: { base: 10, xp: 0 },
    agilite: { base: 10, xp: 0 },
    focus: { base: 10, xp: 0 },
  },
  hp: { current: 20, max: 20 },
  mp: { current: 0, max: 0 },
})

function App() {
  const [tab, setTab] = useState('character')
  const [char, setChar] = useState(createEmptyCharacter())
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const chatRef = useRef(null)

  const getTotal = (stat) => char.stats[stat].base + char.stats[stat].xp

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [msgs])

  useEffect(() => {
    OBR.onReady(() => console.log('Ready!'))
  }, [])

  const updateStat = (stat, field, val) => {
    setChar(p => ({
      ...p,
      stats: { ...p.stats, [stat]: { ...p.stats[stat], [field]: parseInt(val) || 0 } }
    }))
  }

  const roll = (stat) => {
    const target = getTotal(stat)
    const result = rollDice(20)
    setMsgs(p => [...p, { id: Date.now(), stat, result, target, success: result <= target }])
  }

  const adjustHP = (amt) => {
    setChar(p => ({ ...p, hp: { ...p.hp, current: Math.max(0, Math.min(p.hp.max, p.hp.current + amt)) } }))
  }

  return (
    <div className="app">
      <div className="tabs">
        <button className={tab === 'character' ? 'active' : ''} onClick={() => setTab('character')}>Character</button>
        <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>Chat</button>
      </div>

      {tab === 'character' && (
        <div className="content">
          <div className="section">
            <input value={char.name} onChange={(e) => setChar(p => ({ ...p, name: e.target.value }))} />
            <div>Level: <input type="number" value={char.level} onChange={(e) => setChar(p => ({ ...p, level: parseInt(e.target.value) || 1 }))} /></div>
          </div>

          <div className="section">
            <h3>Stats</h3>
            {Object.keys(char.stats).map(s => (
              <div key={s} className="stat">
                <span>{s}: {getTotal(s)}</span>
                <input type="number" value={char.stats[s].base} onChange={(e) => updateStat(s, 'base', e.target.value)} />
                <input type="number" value={char.stats[s].xp} onChange={(e) => updateStat(s, 'xp', e.target.value)} />
                <button onClick={() => roll(s)}>Roll</button>
              </div>
            ))}
          </div>

          <div className="section">
            <div>HP: {char.hp.current}/{char.hp.max}</div>
            <button onClick={() => adjustHP(5)}>+5</button>
            <button onClick={() => adjustHP(-5)}>-5</button>
          </div>
        </div>
      )}

      {tab === 'chat' && (
        <div className="chat">
          <div className="messages" ref={chatRef}>
            {msgs.map(m => (
              <div key={m.id}>
                {m.stat && <div>{m.stat}: 🎲{m.result} (target {m.target}) - {m.success ? '✓' : '✗'}</div>}
              </div>
            ))}
          </div>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && (setMsgs(p => [...p, { id: Date.now(), text: input }]), setInput(''))} />
        </div>
      )}
    </div>
  )
}

export default App
