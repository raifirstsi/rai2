package com.openmausbot.companion.storage

import android.app.LocaleManager
import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.os.LocaleList
import java.util.Locale

object LanguageHelper {
    data class LanguageOption(val tag: String, val label: String)

    val options = listOf(
        LanguageOption("vi", "Tiếng Việt"),
        LanguageOption("en", "English"),
        LanguageOption("zh-Hans", "中文 (简体)"),
        LanguageOption("zh-Hant", "中文 (繁體)"),
    )

    fun labelFor(tag: String): String =
        options.find { it.tag == tag }?.label ?: "Tiếng Việt"

    fun localeForTag(tag: String): Locale = when (tag) {
        "en" -> Locale.ENGLISH
        "zh-Hans" -> Locale.SIMPLIFIED_CHINESE
        "zh-Hant" -> Locale.TRADITIONAL_CHINESE
        else -> Locale("vi")
    }

    fun applyLocale(context: Context, tag: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val localeManager = context.getSystemService(LocaleManager::class.java)
            localeManager?.applicationLocales = LocaleList.forLanguageTags(tag)
        }
    }

    fun wrapContext(base: Context, tag: String): Context {
        val locale = localeForTag(tag)
        Locale.setDefault(locale)
        val config = Configuration(base.resources.configuration)
        config.setLocale(locale)
        return base.createConfigurationContext(config)
    }
}
