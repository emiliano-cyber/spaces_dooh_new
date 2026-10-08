package com.spaceeye.agent.update

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Cuando la app se puede actualizar SIN que nadie toque el telefono. Es lo que
 * el panel muestra en la ficha del equipo, asi que tiene que decir la verdad:
 * prometer "se actualiza sola" a un telefono que va a pedir un toque manda a
 * alguien a un sitio para nada (o deja la flota a medio actualizar).
 */
class AutoActualizacionTest {
    private val pkg = "com.spaceeye.agent"
    private fun d(owner: Boolean = false, sdk: Int = 33, permiso: Boolean = true, instalar: Boolean = true, dueno: String? = null) =
        AppUpdater.decidir(owner, sdk, permiso, instalar, dueno, pkg)

    @Test fun androidModernoConPermisoSeActualizaSola() = assertEquals("sola", d())

    @Test fun kioscoGanaATodo() = assertEquals("kiosco", d(owner = true, sdk = 28, permiso = false, instalar = false))

    @Test fun antesDeAndroid12NoHaySinToque() = assertEquals("android_viejo", d(sdk = 30))

    @Test fun sinElPermisoDeLa0164PideToque() = assertEquals("sin_permiso", d(permiso = false))

    @Test fun conInstalarAppsDesconocidasApagadoPideToque() = assertEquals("sin_instalar_apps", d(instalar = false))

    @Test fun android14ConOtraTiendaComoDuenaPideToque() = assertEquals("otro_dueno", d(sdk = 34, dueno = "com.android.vending"))

    @Test fun android14SiendoDuenaDeSiMismaSeActualizaSola() = assertEquals("sola", d(sdk = 34, dueno = pkg))

    @Test fun soloSolaYKioscoCuentanComoSola() {
        assertEquals(true, AppUpdater.AutoActualizacion("sola", null, 33).sola)
        assertEquals(true, AppUpdater.AutoActualizacion("kiosco", null, 28).sola)
        assertEquals(false, AppUpdater.AutoActualizacion("sin_permiso", null, 33).sola)
    }
}
