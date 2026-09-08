package com.tobietheunknown.pianoteacher.utils

import com.tobietheunknown.pianoteacher.data.model.NoteEvent
import kotlin.math.abs

data class RepeatedMotif(val groups: List<List<NoteEvent>>, val repetitions: Int)

/** Lossless ordered pitch segmentation; the native counterpart of repeatedMotifs.js. */
fun segmentRepeatedMotifs(notes: List<NoteEvent>): List<RepeatedMotif> {
    val groups = mutableListOf<MutableList<NoteEvent>>()
    for (note in notes.sortedBy { it.startTime }) {
        val last = groups.lastOrNull()
        if (last != null && abs(last.first().startTime - note.startTime) < 1e-6) last.add(note)
        else groups.add(mutableListOf(note))
    }
    val keys = groups.map { group -> group.map { it.pitch }.sorted() }
    val n = keys.size
    data class Choice(val cost: Int, val rows: Int, val length: Int = 0, val reps: Int = 0, val end: Int = 0)
    val best = arrayOfNulls<Choice>(n + 1)
    best[n] = Choice(0, 0)
    for (i in n - 1 downTo 0) {
        best[i] = Choice(1 + best[i + 1]!!.cost, 1 + best[i + 1]!!.rows, 1, 1, i + 1)
        for (length in 1..(n - i) / 2) {
            for (reps in 2..(n - i) / length) {
                val nextStart = i + (reps - 1) * length
                if ((0 until length).any { keys[i + it] != keys[nextStart + it] }) break
                val end = i + length * reps
                val cost = length + 1 + best[end]!!.cost
                val rows = 1 + best[end]!!.rows
                if (cost < best[i]!!.cost || (cost == best[i]!!.cost && rows <= best[i]!!.rows)) {
                    best[i] = Choice(cost, rows, length, reps, end)
                }
            }
        }
    }
    val result = mutableListOf<RepeatedMotif>()
    var i = 0
    while (i < n) {
        val choice = best[i]!!
        val previous = result.lastOrNull()
        if (choice.reps == 1 && previous?.repetitions == 1) {
            result[result.lastIndex] = previous.copy(groups = previous.groups + listOf(groups[i]))
        } else result.add(RepeatedMotif(groups.subList(i, i + choice.length).map { it.toList() }, choice.reps))
        i = choice.end
    }
    return result
}
