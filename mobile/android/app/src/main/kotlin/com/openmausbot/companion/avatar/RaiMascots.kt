package com.openmausbot.companion.avatar

import androidx.annotation.DrawableRes
import com.openmausbot.companion.R
import com.openmausbot.companion.core.Bot

object RaiMascots {
    val MASCOT_DRAWABLES: List<Int> = listOf(
        R.drawable.mascot_1,
        R.drawable.mascot_2,
        R.drawable.mascot_3,
        R.drawable.mascot_4,
        R.drawable.mascot_5,
        R.drawable.mascot_6,
        R.drawable.mascot_7,
        R.drawable.mascot_8,
        R.drawable.mascot_9,
        R.drawable.mascot_10,
        R.drawable.mascot_11,
        R.drawable.mascot_12,
        R.drawable.mascot_13,
        R.drawable.mascot_14,
        R.drawable.mascot_15,
    )

    @DrawableRes
    fun getMascotDrawable(bot: Bot): Int {
        val nameLower = bot.name.lowercase().trim()
        val idLower = bot.id.lowercase().trim()

        if (nameLower.contains("rai") || idLower.contains("rai") || bot.chiefOfStaff == true || bot.color == "chrome") {
            return R.drawable.bot_mascot_circle
        }

        if (nameLower.contains("assistant") || idLower.contains("assistant")) return R.drawable.mascot_1
        if (nameLower.contains("inbox") || idLower.contains("inbox")) return R.drawable.mascot_2
        if (nameLower.contains("scout") || nameLower.contains("research") || idLower.contains("research")) return R.drawable.mascot_3
        if (nameLower.contains("dev") || nameLower.contains("coder") || idLower.contains("coder")) return R.drawable.mascot_4
        if (nameLower.contains("watch") || nameLower.contains("community") || idLower.contains("community")) return R.drawable.mascot_5
        if (nameLower.contains("buzz") || nameLower.contains("social") || idLower.contains("social")) return R.drawable.mascot_6
        if (nameLower.contains("ops") || idLower.contains("ops")) return R.drawable.mascot_7
        if (nameLower.contains("quill") || nameLower.contains("writer") || idLower.contains("writer")) return R.drawable.mascot_8
        if (nameLower.contains("sigma") || nameLower.contains("analyst") || idLower.contains("analyst")) return R.drawable.mascot_1

        val keyStr = bot.id.ifEmpty { bot.name.ifEmpty { bot.color } }
        var hash = 0
        for (ch in keyStr) {
            hash = (hash shl 5) - hash + ch.code
        }
        val idx = kotlin.math.abs(hash) % MASCOT_DRAWABLES.size
        return MASCOT_DRAWABLES[idx]
    }
}
