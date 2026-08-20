import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export function useCurrentSeason() {
  const [season, setSeasonState] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('app_settings').select('current_season').eq('id', 1).single()
      setSeasonState(data?.current_season || null)
      setLoading(false)
    }
    load()
  }, [])

  async function setSeason(newSeason) {
    setSeasonState(newSeason)
    await supabase.from('app_settings').update({ current_season: newSeason }).eq('id', 1)
  }

  return { season, setSeason, loading }
}
