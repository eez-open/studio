// SPDX-FileCopyrightText: 2023 EEZ Studio Contributors
//
// SPDX-License-Identifier: GPL-3.0-only

import { service } from "eez-studio-shared/service";

import { db } from "eez-studio-shared/db";

export default service<void, void>("db-services/vacuum", async () => {
    db.exec("VACUUM");
});
