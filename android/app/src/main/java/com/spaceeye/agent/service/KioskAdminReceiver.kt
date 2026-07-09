package com.spaceeye.agent.service

import android.app.admin.DeviceAdminReceiver

/**
 * Componente de administrador de dispositivo. Necesario para activar el modo
 * kiosco REAL (Lock Task sin salida). Se habilita convirtiendo la app en
 * "device owner" via ADB en un equipo recien reseteado:
 *
 *   adb shell dpm set-device-owner com.spaceeye.agent/.service.KioskAdminReceiver
 *
 * Ver docs/ANDROID_RESILIENCE.md.
 */
class KioskAdminReceiver : DeviceAdminReceiver()
