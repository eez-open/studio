import { service } from "eez-studio-shared/service";

import { db } from "eez-studio-shared/db";

export default service<void, void>("db-services/vacuum", async () => {
    db.exec("VACUUM");
});
