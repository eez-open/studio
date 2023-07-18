# DESCRIPTION [DRAFT]

Ispituje `boolean` varijablu i ako je `false` onda je postavlja na `true` i izlazi na sekvencijalni output (`seqout`), a ako je `true` onda se ponovno stavlja u flow execution queue, tj. ova akcija čeka dok varijabla ne postane `false`. Ovo testiranje i postavljanje se obavalja **as a single atomic (non-interruptable) operation**, pa je ova akcija pogodna za slučaj kada se želi biti siguran da u nekom trenutku se kroz određeni dio flowa prolazi samo jednom. U tom slučaju negdje na ulazu u taj dio flowa treba postaviti ovu akciju i na izlazu iz flowa treba ponovno varijablu postaviti na `false` sa `SetVariable` akcijom.

![Alt text](../images/test_and_set.png)

# PROPERTIES

## Variable [DRAFT]

Varijabla koja se testira i postavlja.

# INPUTS

## seqin [DRAFT]

A standard sequential input.

# OUTPUTS

## seqout [DRAFT]

Na ovaj sekvencijalni output se izlazi kada varijabla postane `false`.

# EXAMPLES [DRAFT]

-   Tetris

    U `do_action` user akciji, koja se poziva kada se detektira da je prisnuta neka tipka na tikovnici, na ulazu imamo TestAndSet akciju nad `busy` varijablom, a na izlazu se `busy` varijabla postavlja na false. Na ovaj način smo sigurni da se neće desiti da u isto vrijeme paralelno izvršavamo dvije akcije.
